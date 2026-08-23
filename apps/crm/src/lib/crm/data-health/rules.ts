/**
 * DATA WALK v1 — the deterministic rule catalog as org-pinned, read-only SQL.
 *
 * IDENTITY LIVES IN ./score.ts (`RULE_CATALOG`: keys, labels, severities) —
 * shared with the prod audit script and the ratchet. This module attaches to
 * each catalog entry its plain-language `describe` and its SQL, and exposes
 * `runRules(executor)`: execution is injected, so the same catalog runs
 * against the local stack, prod, and the service-role conduit without this
 * module knowing about clients or keys.
 *
 * Every query was verified against the REAL schema (local stack + baseline
 * migration, 2026-08-23):
 *   - There are NO `contacts` / `leads` tables — people live in `crm_records`
 *     keyed by `module_id` → `crm_modules.key` ('contacts' | 'leads' |
 *     'members' | 'advisors'). Queries join on module KEY, never hardcoded
 *     module ids, so they hold wherever ids differ.
 *   - `linked_member_id` lives in `crm_records.data` and points at
 *     `public.members.id` (see lead-conversion-sync).
 *   - Producer attribution is `data->>'producer_name'`, matched against
 *     `public.advisors` (org column: organization_id).
 *   - Import jobs terminal states: completed, completed_with_errors, failed,
 *     cancelled (crm_import_jobs_status_check, 20260804110101).
 *
 * FIELD-CORRECTNESS PASS, 2026-08-23 (formula v2). Every rule below was
 * re-measured against production, read-only, and six of them were reading a
 * column that is NOT where their concept lives. The standing rule this file is
 * now held to: a query that parses and returns a number proves nothing — the
 * column it reads must be shown to be the column the concept actually lives
 * in, and the count must mean what the label promises. The traps that were
 * real here, kept as a checklist for the next rule anyone adds:
 *
 *   - VESTIGIAL COLUMNS the migration never filled. `members.effective_date`
 *     is set on 2 of 997 live members; coverage dates live on `enrollments`
 *     (effective_date/start_date/primary_member_id 1,098/1,098). Two rules
 *     were reading the dead column.
 *   - MASS-RESET TIMESTAMPS. `crm_records.updated_at` was reset book-wide by
 *     the August backfill (15,894 of 16,284 live rows stamped 2026-08), so it
 *     carries no staleness signal. `stage_updated_at` survived intact.
 *   - CONCEPTS THAT LIVE PER MODULE. Ownership is `data->>'lead_owner'` on
 *     leads and `data->>'contact_owner'` on contacts — a rule that reads only
 *     the contacts-era `producer_name` calls an entire module ownerless.
 *   - JSONB KEY DRIFT. This book's second email address is
 *     `data->>'secondary_email'` (1,262 contacts), not `data->>'email2'` (29).
 *   - NULLABLE-BY-DESIGN COLUMNS. `crm_tasks.record_id` is nullable and a
 *     standalone task is a supported feature; `IS NULL` there is not a broken
 *     reference.
 *   - COMPOSITE REFERENCE DATA. `advisors.full_name` is often
 *     "Person - Company", and first_name/last_name are a naive split of it, so
 *     an exact-name match manufactures roster gaps.
 *   - EMPTY BOTH SIDES. A join whose two sides are 0% populated can only ever
 *     return 0; that is not a clean bill of health (refs.trash-batch,
 *     vocabulary.product, ingest.stuck-imports). Where a rule cannot yet see
 *     its concept, the LABEL says so and a context metric carries the scale.
 *
 * Sample rows carry record IDs ONLY — never names, phones, emails, or DOBs.
 */

import { PENDING_CONTACT_STATUSES } from '../resolve-effective-start-date';
import { FORMULA_VERSION, RULE_CATALOG, computeScore } from './score';
import type {
  DataHealthReport,
  RuleDef,
  RuleError,
  RuleSweepResult,
  SqlExecutor,
} from './types';

/** PIFH tenant — the org every v1 sweep is pinned to. */
export const PIFH_ORG_ID = '00000000-0000-0000-0000-000000000001';

export const SAMPLE_IDS_CAP = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Interpolating into SQL — accept nothing but a literal UUID. */
function assertOrgId(orgId: string): string {
  if (!UUID_RE.test(orgId)) {
    throw new Error(`data-health: orgId must be a UUID, got ${JSON.stringify(orgId)}`);
  }
  return orgId.toLowerCase();
}

/**
 * Wrap an inner `select … id …` query so one round trip returns both the full
 * match count (window count) and a LIMIT-capped id sample.
 */
function wrapSampled(innerSql: string): string {
  return `select q.id::text as id, count(*) over () as total from (${innerSql}) q limit ${SAMPLE_IDS_CAP}`;
}

/** Non-blank text expression helper. */
function nonBlank(expr: string): string {
  return `nullif(trim(${expr}), '') is not null`;
}

/** SQL literal list from a readonly string array. */
function sqlList(values: readonly string[]): string {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
}

/**
 * Coverage start-date keys mirrored from JSONB_START_DATE_KEYS in
 * resolve-effective-start-date.ts (module-private there; keep in sync — the
 * pending-no-start rule must agree with the activate-pending cron).
 */
const START_DATE_JSON_KEYS = [
  'current_year_start_date',
  'original_start_date',
  'start_date',
  'sharing_effective_date',
  'insurance_effective_date',
  'health_insurance_start_date',
  'effective_date',
  'vision_start_date',
  'dental_start_date',
] as const;

const UUID_SQL_RE = "'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'";

/** Best non-blank value: indexed column first, then the data json key. */
function bestOf(column: string, jsonExpr: string): string {
  return `coalesce(nullif(trim(${column}), ''), nullif(trim(${jsonExpr}), ''))`;
}

/** The person modules every record-level rule sweeps. */
const PERSON_MODULE_KEYS = "'contacts', 'leads', 'members'";

/**
 * Whitespace-collapsed, case-folded text — the comparison shape the JS sweep
 * (`scripts/audit-crm-data-health.mjs`) uses, so the two implementations of a
 * rule cannot disagree on "the same value spelled with two spaces".
 */
function normText(expr: string): string {
  return `lower(btrim(regexp_replace(coalesce(${expr}, ''), '\\s+', ' ', 'g')))`;
}

/** Non-blank normalized text, or NULL. */
function normTextOrNull(expr: string): string {
  return `nullif(${normText(expr)}, '')`;
}

/** Last 10 digits of a phone-ish value, or NULL — the book's phone identity. */
function phoneKey(expr: string): string {
  return `nullif(right(regexp_replace(coalesce(${expr}, ''), '\\D', '', 'g'), 10), '')`;
}

/**
 * Orphaned child rows.
 *
 * `record_id IS NOT NULL` is deliberate and load-bearing: `crm_tasks.record_id`
 * is NULLABLE by design (api/tasks/route.ts writes `record_id || null`) and a
 * standalone task is a supported product feature that the calendar and the
 * organizer both render — it is not a dangling reference. Including the NULL
 * case reported 3 healthy tasks as broken foreign keys at error severity.
 * `crm_notes`/`crm_attachments` are NOT NULL, so the clause is inert there.
 *
 * The parent lookup is org-scoped so a pointer into ANOTHER tenant's records
 * counts as orphaned (fails closed) and so this SQL and the JS sweep, which
 * only ever holds one org's records, cannot diverge.
 */
function orphanRefSql(table: 'crm_notes' | 'crm_tasks' | 'crm_attachments') {
  return (orgId: string) =>
    wrapSampled(
      `select n.id
from ${table} n
where n.org_id = '${assertOrgId(orgId)}'
  and n.deleted_at is null
  and n.record_id is not null
  and not exists (
    select 1 from crm_records r
    where r.id = n.record_id and r.org_id = '${assertOrgId(orgId)}')`,
    );
}

/** Corpus size for an orphan rule — so a 0 over 1 attachment is read in scale. */
function corpusSizeSql(table: 'crm_notes' | 'crm_tasks' | 'crm_attachments') {
  return (orgId: string) =>
    `select count(*) as value
from ${table} n
where n.org_id = '${assertOrgId(orgId)}'
  and n.deleted_at is null`;
}

function pendingStatusFilter(alias: string): string {
  return `${alias}.status in (${sqlList(PENDING_CONTACT_STATUSES)})`;
}

/**
 * The identity FAMILIES the twin rule compares.
 *
 * Comparing one slot to one slot manufactured conflicts: 44 of the 58 "phone
 * drifts" were the member row's phone sitting on the contact as `phone2` or
 * `mobile`, and 21 of the 50 "email drifts" were the same address stored as
 * `email2`/`secondary_email`. The system's own matcher
 * (resolve-member-crm-record.ts) treats those sibling keys as the SAME person
 * — "members-module/portal twins often store the Zoho email as email2" — so a
 * value present anywhere in the family is not drift. Drift is: both sides have
 * at least one value, and the two sets do not overlap at all.
 */
const EMAIL_FIELDS = ['email', "data->>'email'", "data->>'email2'", "data->>'secondary_email'"];
const PHONE_FIELDS = ['phone', "data->>'phone'", "data->>'phone2'", "data->>'mobile'"];

function emailSet(side: string): string {
  return `array_remove(array[${EMAIL_FIELDS.map((f) => normTextOrNull(`${side}.${f}`)).join(', ')}], null)`;
}

function phoneSet(side: string): string {
  return `array_remove(array[${PHONE_FIELDS.map((f) => phoneKey(`${side}.${f}`)).join(', ')}], null)`;
}

/**
 * Two non-blank names that differ — except when one is a prefix of the other
 * (Dave/David, Cathy/Catherine, min 3 chars). Nickname noise is not a data
 * conflict anyone can act on; without this guard 11 twins were reported purely
 * for a shortened first name.
 */
function nameDrift(a: string, b: string): string {
  const k = `least(length(${a}), length(${b}))`;
  return `(${a} is not null and ${b} is not null and ${a} <> ${b}
      and not (${k} >= 3 and left(${a}, ${k}) = left(${b}, ${k})))`;
}

interface RuleSqlSpec {
  /**
   * OWNER-FACING. Renders verbatim on the card, under the rule's label, to a
   * business owner who has never seen this schema. Plain language only: no
   * table or column names, no `cron`, `RLS`, `NOT NULL`, `data->>`, no
   * "pre-guard residue". `describe-vocabulary.test.ts` enforces that.
   */
  describe: string;
  /**
   * ENGINEER-FACING, and deliberately NOT shipped to the page — the route
   * whitelists the fields it sends and this is not one of them. This is where
   * the hard-won "why is the SQL shaped like this" knowledge from the prod
   * sweeps lives: which column the dates really sit in, which backfill poisoned
   * which timestamp, what a 0 here does and does not prove.
   */
  rationale?: string;
  buildSql(orgId: string): string;
  buildContextSql?(orgId: string): string;
  contextLabel?: string;
}

/** SQL + plain-language meaning for every key in RULE_CATALOG. */
const RULE_SQL: Record<string, RuleSqlSpec> = {
  'vocabulary.status': {
    describe:
      'These records carry a status word that is no longer on the approved list for their module, so filters and counts that look for the real statuses quietly skip them. Nobody can save a new one — these are leftovers from before that rule existed.',
    rationale:
      'The DB status guard stops new writes, so this counts pre-guard residue only. Compared against crm_status_vocabulary per module key.',
    buildSql: (orgId) =>
      wrapSampled(
        `select r.id
from crm_records r
join crm_modules m on m.id = r.module_id
join crm_status_vocabulary v on v.org_id = r.org_id and v.module_key = m.key
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and ${nonBlank('r.status')}
  and not (r.status = any(v.statuses))`,
      ),
  },
  'vocabulary.product': {
    describe:
      'This zero is not a clean bill of health. No product dropdown list has been set up yet, so there is nothing for this check to compare against — it means "nothing to check", not "everything matches". The number beside it is the real exposure: records carrying a typed-in product name that no list can validate. Build the list under Settings → Dropdown lists and this check starts protecting you.',
    rationale:
      'All three product field definitions currently have options: [], so the mismatch set is necessarily empty. The context metric carries the real free-text exposure.',
    buildSql: (orgId) =>
      wrapSampled(
        `with opts as (
  select f.module_id,
         f.key as field_key,
         ${normTextOrNull(`coalesce(e->>'value', e->>'label', e #>> '{}')`)} as val,
         case when e->>'is_active' in ('false', 'f', '0') then false else true end as active
  from crm_fields f
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(f.options) = 'array' then f.options else '[]'::jsonb end) e
  where f.org_id = '${assertOrgId(orgId)}'
)
select r.id
from crm_records r
join crm_modules m on m.id = r.module_id and m.key in ('contacts', 'leads')
cross join lateral (select case m.key when 'contacts' then 'product' else 'product_type' end as k) fk
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and ${nonBlank('r.data->>fk.k')}
  and exists (
    select 1 from opts o
    where o.module_id = r.module_id and o.field_key = fk.k and o.active and o.val is not null)
  and not exists (
    select 1 from opts o
    where o.module_id = r.module_id and o.field_key = fk.k and o.active
      and o.val = ${normText('r.data->>fk.k')})`,
      ),
    contextLabel: 'Product values with no list to check them against',
    buildContextSql: (orgId) =>
      `select count(*) as value
from crm_records r
join crm_modules m on m.id = r.module_id and m.key in ('contacts', 'leads')
cross join lateral (select case m.key when 'contacts' then 'product' else 'product_type' end as k) fk
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and ${nonBlank('r.data->>fk.k')}
  and not exists (
    select 1 from crm_fields f
    where f.org_id = r.org_id and f.module_id = r.module_id and f.key = fk.k
      -- CASE, not AND: Postgres does not short-circuit, and jsonb_array_length
      -- throws on a non-array options value.
      and case when jsonb_typeof(f.options) = 'array'
               then jsonb_array_length(f.options) > 0 else false end)`,
  },
  'vocabulary.producer': {
    describe:
      'Ways of writing an enrolling agent’s name that do not match anyone on the advisor roster and were never linked to an advisor. This counts SPELLINGS, not records, because a spelling is the thing you fix — add that person to the roster, or correct the typo once. The number beside it is how many records use them. Commissions are not at risk: records that already point at a real advisor are not counted here.',
    rationale:
      'Attribution runs on crm_records.canonical_advisor_id, which is already set on the records this rule skips. Counted per distinct normalized spelling; context carries the record count.',
    buildSql: (orgId) =>
      wrapSampled(
        `select (array_agg(r.id order by r.id))[1] as id
from crm_records r
join crm_modules m on m.id = r.module_id and m.key in (${PERSON_MODULE_KEYS})
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and r.canonical_advisor_id is null
  and ${nonBlank("r.data->>'producer_name'")}
  and not exists (
    select 1 from advisors a
    where a.organization_id = '${assertOrgId(orgId)}'
      and a.deleted_at is null
      and (
        ${normText('a.full_name')} = ${normText("r.data->>'producer_name'")}
        -- advisors.full_name is composite ("Person - Company") and one human
        -- has one row per company, so compare the person-head too. Do NOT use
        -- first_name/last_name: they are a naive split of the same composite.
        or ${normText("split_part(a.full_name, '-', 1)")}
           = ${normText(`split_part(regexp_replace(r.data->>'producer_name', '\\s+MPB Leads\\s*$', '', 'i'), '-', 1)`)}
      ))
group by ${normText("r.data->>'producer_name'")}
order by 1`,
      ),
    contextLabel: 'Records carrying those spellings',
    buildContextSql: (orgId) =>
      `select count(*) as value
from crm_records r
join crm_modules m on m.id = r.module_id and m.key in (${PERSON_MODULE_KEYS})
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and r.canonical_advisor_id is null
  and ${nonBlank("r.data->>'producer_name'")}
  and not exists (
    select 1 from advisors a
    where a.organization_id = '${assertOrgId(orgId)}'
      and a.deleted_at is null
      and (
        ${normText('a.full_name')} = ${normText("r.data->>'producer_name'")}
        or ${normText("split_part(a.full_name, '-', 1)")}
           = ${normText(`split_part(regexp_replace(r.data->>'producer_name', '\\s+MPB Leads\\s*$', '', 'i'), '-', 1)`)}
      ))`,
  },
  'refs.orphan-notes': {
    describe:
      'These notes belong to nobody. The person or deal they were written about is gone, so everything typed into them is invisible everywhere in the CRM. This should always be zero — the database is built to make it impossible — so treat this as a smoke alarm rather than a score to be proud of.',
    rationale:
      'crm_notes.record_id is NOT NULL with an ON DELETE CASCADE FK, so a non-zero here means that guarantee broke. Read it next to the corpus size in context.',
    buildSql: orphanRefSql('crm_notes'),
    contextLabel: 'Notes in the book',
    buildContextSql: corpusSizeSql('crm_notes'),
  },
  'refs.orphan-tasks': {
    describe:
      'These tasks are attached to a person or deal that no longer exists, so the follow-up they stand for can never be found or completed from a record. Tasks that were never attached to anyone are fine and are not counted — a standalone task still shows up on the calendar and in the organizer.',
    rationale:
      'crm_tasks.record_id is NULLABLE by design, so a null is a standalone task, not an orphan. Only non-null ids pointing at a missing row count.',
    buildSql: orphanRefSql('crm_tasks'),
    contextLabel: 'Tasks in the book',
    buildContextSql: corpusSizeSql('crm_tasks'),
  },
  'refs.orphan-attachments': {
    describe:
      'These files are attached to a person or deal that no longer exists — they still take up storage, but nobody can reach them through the CRM. Read the number beside it before you relax: there is only one attachment in the whole book, so a zero here is reassurance about almost nothing.',
    rationale:
      'Context carries the total attachment count precisely because the corpus is 1 — the rule cannot prove much either way at this size.',
    buildSql: orphanRefSql('crm_attachments'),
    contextLabel: 'Attachments in the book',
    buildContextSql: corpusSizeSql('crm_attachments'),
  },
  'refs.trash-batch': {
    describe:
      'Deleted records the Trash screen cannot put back as a group, because the deletion never left a receipt saying what was deleted together. They can still be restored one at a time. Records removed by merging two duplicates are not counted — those are meant to disappear and come back through the merge instead.',
    rationale:
      'Only crm_soft_delete_records_bulk writes a crm_trash_batches receipt; every other delete path leaves none. Merge-losers are excluded deliberately.',
    buildSql: (orgId) =>
      wrapSampled(
        `select r.id
from crm_records r
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is not null
  and coalesce(r.deleted_origin, '') <> 'merge'
  and (
    r.delete_batch_id is null
    or not exists (
      select 1 from crm_trash_batches tb
      where tb.id = r.delete_batch_id and tb.organization_id = r.org_id)
  )`,
      ),
    contextLabel: 'Merge-origin deletes (restored by merge, not by batch)',
    buildContextSql: (orgId) =>
      `select count(*) as value
from crm_records r
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is not null
  and coalesce(r.deleted_origin, '') = 'merge'`,
  },
  'refs.linked-member': {
    describe:
      'These contacts say they are linked to a member, but the membership they point at does not exist in your book. Anything that follows that link — the member portal, billing — finds nothing.',
    rationale:
      'The members lookup is org-scoped on purpose: a linked_member_id reaching into another tenant is broken, not valid.',
    buildSql: (orgId) =>
      wrapSampled(
        `select r.id
from crm_records r
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and ${nonBlank("r.data->>'linked_member_id'")}
  and case
    when r.data->>'linked_member_id' ~* ${UUID_SQL_RE}
      then not exists (
        select 1 from members mm
        where mm.id = (r.data->>'linked_member_id')::uuid
          and mm.organization_id = r.org_id)
    else true
  end`,
      ),
  },
  'twins.contact-member': {
    describe:
      'The same member number appears on both a Member and a Contact, but the two disagree about who the person is — they share no email address, share no phone number, or carry genuinely different names. Opening either one shows you only half the story, and nothing on screen warns you the other half disagrees. Nicknames like Dave and David are not counted as a disagreement.',
    rationale:
      'Emails compared across email/email2/secondary_email, phones across phone/phone2/mobile — sibling fields count as the same person, matching the system’s own matcher. nameDrift() suppresses prefix nicknames. The twin overlay only fills blanks, which is why a conflict stays invisible.',
    buildSql: (orgId) =>
      wrapSampled(
        `select distinct mem.id
from crm_records mem
join crm_modules mmod on mmod.id = mem.module_id and mmod.key = 'members'
join crm_records c on c.org_id = mem.org_id
join crm_modules cmod on cmod.id = c.module_id and cmod.key = 'contacts'
cross join lateral (
  select ${emailSet('mem')} as m_emails,
         ${emailSet('c')} as c_emails,
         ${phoneSet('mem')} as m_phones,
         ${phoneSet('c')} as c_phones,
         ${normTextOrNull("mem.data->>'first_name'")} as m_first,
         ${normTextOrNull("c.data->>'first_name'")} as c_first,
         ${normTextOrNull("mem.data->>'last_name'")} as m_last,
         ${normTextOrNull("c.data->>'last_name'")} as c_last
) p
where mem.org_id = '${assertOrgId(orgId)}'
  and mem.deleted_at is null
  and c.deleted_at is null
  and ${nonBlank("mem.data->>'member_number'")}
  and trim(c.data->>'member_number') = trim(mem.data->>'member_number')
  and (
    (cardinality(p.m_emails) > 0 and cardinality(p.c_emails) > 0 and not (p.m_emails && p.c_emails))
    or (cardinality(p.m_phones) > 0 and cardinality(p.c_phones) > 0 and not (p.m_phones && p.c_phones))
    or ${nameDrift('p.m_first', 'p.c_first')}
    or (p.m_last is not null and p.c_last is not null and p.m_last <> p.c_last)
  )`,
      ),
  },
  'dates.impossible': {
    describe:
      'A birth date that cannot be real — in the future, or before 1900 — or coverage that starts before the person was born. These are almost always a typo or a placeholder somebody typed to get past a required field.',
    rationale:
      'Coverage dates read from ENROLLMENTS, where they actually live: members.effective_date is populated on 2 of 997 and can never fire. The old legacy-pre-renewal-start vs dependent-DOB comparison was removed — it flagged a placeholder-DOB cluster, not a real conflict.',
    buildSql: (orgId) =>
      wrapSampled(
        `select x.id from (
  select r.id
  from crm_records r
  where r.org_id = '${assertOrgId(orgId)}'
    and r.deleted_at is null
    and r.data->>'date_of_birth' ~ '^\\d{4}-\\d{2}-\\d{2}$'
    and ((r.data->>'date_of_birth')::date > current_date
      or (r.data->>'date_of_birth')::date < date '1900-01-01')
  union
  select m.id
  from members m
  where m.organization_id = '${assertOrgId(orgId)}'
    and m.deleted_at is null
    and m.merged_into_id is null
    and m.date_of_birth is not null
    and (m.date_of_birth > current_date
      or m.date_of_birth < date '1900-01-01'
      or exists (
        select 1 from enrollments e
        where e.organization_id = m.organization_id
          and e.deleted_at is null
          and (e.primary_member_id = m.id or e.id = m.primary_enrollment_id)
          and coalesce(e.effective_date, e.start_date) < m.date_of_birth))
) x`,
      ),
  },
  'dates.pending-no-start': {
    describe:
      'These people are waiting for coverage to begin, but no start date was ever recorded for them. Nothing will ever switch them on by itself — they will sit in Pending until somebody opens each one and fills the date in. New records can no longer be saved this way; these are older ones.',
    rationale:
      'No start date anywhere the daily activate-pending job looks. The server invariant blocks new ones, so this is pre-guard residue.',
    buildSql: (orgId) =>
      wrapSampled(
        `select r.id
from crm_records r
join crm_modules m on m.id = r.module_id and m.key <> 'leads'
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and ${pendingStatusFilter('r')}
  and r.original_start_date is null
  and r.current_year_start_date is null
  and ${START_DATE_JSON_KEYS.map((key) => `nullif(trim(r.data->>'${key}'), '') is null`).join('\n  and ')}`,
      ),
  },
  'dupes.open-pairs': {
    describe:
      'Pairs still waiting in the Review Duplicates queue — two records that are probably the same person. Until someone merges or dismisses each pair, that person’s history is split across both, and whichever one you open shows you only part of it.',
    buildSql: (orgId) =>
      wrapSampled(
        `select p.left_id as id
from crm_probable_duplicates p
where p.org_id = '${assertOrgId(orgId)}'`,
      ),
    contextLabel: 'Dismissed pairs',
    buildContextSql: (orgId) =>
      `select count(*) as value
from crm_duplicate_dismissals d
where d.organization_id = '${assertOrgId(orgId)}'`,
  },
  'lifecycle.no-owner': {
    describe:
      'Nobody is accountable for these people. There is no owner, no advisor attached, and no name written in any of the places this book keeps one — so nothing reaches them and nobody is measured on them.',
    rationale:
      'Ownership is stored per module: leads in data->>’lead_owner’, contacts in data->>’contact_owner’, plus normalized_advisor_name / producer_name. Reading only owner_id/advisor_id/producer_name called 423 attributed people ownerless — most of one module.',
    buildSql: (orgId) =>
      wrapSampled(
        `select r.id
from crm_records r
join crm_modules m on m.id = r.module_id and m.key in (${PERSON_MODULE_KEYS})
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and r.owner_id is null
  and r.advisor_id is null
  and r.canonical_advisor_id is null
  and ${normTextOrNull('r.normalized_advisor_name')} is null
  and ${normTextOrNull('r.normalized_agent_name')} is null
  and ${normTextOrNull("r.data->>'producer_name'")} is null
  and ${normTextOrNull("r.data->>'lead_owner'")} is null
  and ${normTextOrNull("r.data->>'contact_owner'")} is null`,
      ),
  },
  'lifecycle.stale-pending': {
    describe:
      'Still waiting to activate after more than 45 days in that stage. The data is not broken — this is usually an application somebody gave up on, or a start date that quietly slipped past. Worth a look before it becomes a surprise.',
    rationale:
      'Dwell measured on stage_updated_at, NOT updated_at: an August bulk backfill restamped updated_at on 15,894 of 16,284 live records, which made this rule report a clean 0 over a book holding 41 stale pending applications.',
    buildSql: (orgId) =>
      wrapSampled(
        `select r.id
from crm_records r
join crm_modules m on m.id = r.module_id and m.key <> 'leads'
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and ${pendingStatusFilter('r')}
  and coalesce(r.stage_updated_at, r.created_at) < now() - interval '45 days'`,
      ),
  },
  'lifecycle.null-status': {
    describe:
      'These records have no status at all, so every lane, filter and count on the site skips straight past them. They are effectively invisible while still sitting in your book. Some of them are recoverable — the status they came over with is still stored on the record, it just never made it into the field the CRM reads.',
    rationale:
      'Swept across ALL modules, not only the person ones. The recoverable ones still carry data->>’contact_status’ / data->>’lead_status’ that never landed in the status column.',
    buildSql: (orgId) =>
      wrapSampled(
        `select r.id
from crm_records r
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and nullif(trim(r.status), '') is null`,
      ),
  },
  'ingest.stuck-imports': {
    describe:
      'Imports that stopped partway and never finished or failed cleanly, long enough ago that the automatic cleanup should already have caught them. Some of their rows may have been applied and some not, so the file is neither in nor out. Imports that are simply waiting for someone to approve them are not counted, and neither is one that is still working through its batches.',
    rationale:
      'Scoped and timed to match reap_stalled_import_jobs exactly. data_job rows excluded — they wait on human approval by design and the old rule called the first one stuck. Staleness measured from the last pass heartbeat so a healthy resumable apply is never flagged. The old 24-hour threshold was unreachable: the */15 job terminalizes a real stall after one hour.',
    buildSql: (orgId) =>
      wrapSampled(
        `select j.id
from crm_import_jobs j
where j.org_id = '${assertOrgId(orgId)}'
  and j.status in ('pending', 'validating', 'processing')
  and j.source_type in ('csv', 'csv_upload', 'csv_update', 'export', 'zoho')
  and greatest(
        coalesce((j.stats->>'last_pass_at')::timestamptz, '-infinity'::timestamptz),
        coalesce(j.started_at, j.created_at)
      ) < now() - interval '2 hours'`,
      ),
    contextLabel: 'Import jobs on file',
    buildContextSql: (orgId) =>
      `select count(*) as value
from crm_import_jobs j
where j.org_id = '${assertOrgId(orgId)}'`,
  },
  'completeness.unreachable': {
    describe:
      'There is no phone number and no email address anywhere on these records, so there is no way to contact these people at all. Every phone and email field this book actually uses was checked, including the secondary and work ones — not just the main pair.',
    rationale:
      'Checks every channel key in real use, including secondary_email (1,262 contacts) and work_phone (193). The rule previously guarded only email2, which 29 contacts use.',
    buildSql: (orgId) =>
      wrapSampled(
        `select r.id
from crm_records r
join crm_modules m on m.id = r.module_id and m.key = 'contacts'
where r.org_id = '${assertOrgId(orgId)}'
  and r.deleted_at is null
  and ${bestOf('r.phone', "r.data->>'phone'")} is null
  and nullif(trim(r.data->>'phone2'), '') is null
  and nullif(trim(r.data->>'mobile'), '') is null
  and nullif(trim(r.data->>'work_phone'), '') is null
  and ${bestOf('r.email', "r.data->>'email'")} is null
  and nullif(trim(r.data->>'email2'), '') is null
  and nullif(trim(r.data->>'secondary_email'), '') is null`,
      ),
  },
  'completeness.member-core': {
    describe:
      'Members missing the two things billing and the member portal cannot work without: a member number, and a coverage start date on their enrollment. Without both, they cannot be billed correctly and cannot be looked up when they call.',
    rationale:
      'Coverage dates live on ENROLLMENTS. members.effective_date is a vestigial column the Zoho migration never filled (2 of 997 live members); reading it called 995 of 997 members incomplete when the honest answer is 4.',
    buildSql: (orgId) =>
      wrapSampled(
        `select m.id
from members m
where m.organization_id = '${assertOrgId(orgId)}'
  and m.deleted_at is null
  and m.merged_into_id is null
  and (
    nullif(trim(m.member_number), '') is null
    or not exists (
      select 1 from enrollments e
      where e.organization_id = m.organization_id
        and e.deleted_at is null
        and e.effective_date is not null
        and (e.primary_member_id = m.id or e.id = m.primary_enrollment_id))
  )`,
      ),
  },
};

/**
 * THE executable catalog: identity from RULE_CATALOG (score.ts), SQL from
 * RULE_SQL above. Throws at import time if the two ever drift, so a rule can
 * never be silently skipped.
 */
export const DATA_HEALTH_RULES: readonly RuleDef[] = RULE_CATALOG.map((definition) => {
  const spec = RULE_SQL[definition.key];
  if (!spec) {
    throw new Error(`data-health: no SQL implementation for catalog rule ${definition.key}`);
  }
  return { ...definition, ...spec };
});

/** Book size: active (non-deleted) crm_records in the org. */
export function buildBookSizeSql(orgId: string): string {
  return `select count(*) as total from crm_records r where r.org_id = '${assertOrgId(orgId)}' and r.deleted_at is null`;
}

function toCount(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) && (n as number) > 0 ? Math.floor(n as number) : 0;
}

/** Normalize one rule's raw rows into a sweep result (pure; exported for tests). */
export function normalizeRuleRows(
  rule: RuleDef,
  rows: Array<Record<string, unknown>>,
): RuleSweepResult {
  const sampleIds: string[] = [];
  for (const row of rows) {
    const id = row.id;
    if (typeof id === 'string' && id !== '' && !sampleIds.includes(id)) {
      sampleIds.push(id);
    }
    if (sampleIds.length >= SAMPLE_IDS_CAP) break;
  }
  return {
    key: rule.key,
    label: rule.label,
    severity: rule.severity,
    describe: rule.describe,
    count: toCount(rows[0]?.total),
    sampleIds,
  };
}

export interface RunRulesOptions {
  orgId?: string;
  now?: () => Date;
}

/**
 * Run the whole catalog through the injected executor and assemble the
 * versioned report. A rule that throws lands in `errors` (its count is
 * treated as 0 by the formula) instead of killing the sweep. The score is
 * `computeScore` from score.ts — never re-implemented here.
 */
export async function runRules(
  executor: SqlExecutor,
  options: RunRulesOptions = {},
): Promise<DataHealthReport> {
  const orgId = assertOrgId(options.orgId ?? PIFH_ORG_ID);
  const now = options.now ?? (() => new Date());

  let bookSize = 0;
  const errors: RuleError[] = [];
  try {
    const rows = await executor(buildBookSizeSql(orgId));
    bookSize = toCount(rows[0]?.total);
  } catch (error) {
    errors.push({ key: 'book-size', message: error instanceof Error ? error.message : String(error) });
  }

  const rules: RuleSweepResult[] = [];
  for (const rule of DATA_HEALTH_RULES) {
    try {
      const rows = await executor(rule.buildSql(orgId));
      const result = normalizeRuleRows(rule, rows);
      if (rule.buildContextSql && rule.contextLabel) {
        const contextRows = await executor(rule.buildContextSql(orgId));
        result.context = { label: rule.contextLabel, value: toCount(contextRows[0]?.value) };
      }
      rules.push(result);
    } catch (error) {
      errors.push({ key: rule.key, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const counts = Object.fromEntries(rules.map((rule) => [rule.key, rule.count]));

  return {
    version: 1,
    formulaVersion: FORMULA_VERSION,
    generatedAt: now().toISOString(),
    orgId,
    bookSize,
    score: computeScore(counts),
    rules,
    errors,
  };
}
