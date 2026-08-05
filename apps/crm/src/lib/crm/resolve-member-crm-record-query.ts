import type { SupabaseClient } from '@supabase/supabase-js';
import {
  pickBestMemberCrmRecord,
  type MemberCrmLookupInput,
  type MemberCrmRecordCandidate,
} from '@/lib/crm/resolve-member-crm-record';

const CANDIDATE_SELECT =
  'id, email, phone, source_record_id, market_type, updated_at, data, crm_modules!inner(key)';

type RecordRow = {
  id: string;
  email: string | null;
  phone: string | null;
  source_record_id: string | null;
  market_type: string | null;
  updated_at: string | null;
  data: Record<string, unknown> | null;
  crm_modules: { key: string } | { key: string }[] | null;
};

/** PostgREST filter builder after `.select()` — keep loose so call sites stay simple. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CrmRecordsFilterQuery = any;

function toCandidate(row: RecordRow): MemberCrmRecordCandidate {
  const modules = Array.isArray(row.crm_modules)
    ? row.crm_modules
    : row.crm_modules
      ? [row.crm_modules]
      : [];
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    source_record_id: row.source_record_id,
    market_type: row.market_type,
    updated_at: row.updated_at,
    data: row.data,
    module_key: modules[0]?.key ?? null,
  };
}

function dedupeCandidates(rows: RecordRow[]): MemberCrmRecordCandidate[] {
  const byId = new Map<string, MemberCrmRecordCandidate>();
  for (const row of rows) {
    byId.set(row.id, toCandidate(row));
  }
  return Array.from(byId.values());
}

async function fetchContactModuleCandidates(
  supabase: SupabaseClient,
  orgId: string,
  applyFilters: (query: CrmRecordsFilterQuery) => CrmRecordsFilterQuery,
): Promise<RecordRow[]> {
  const base = supabase
    .from('crm_records')
    .select(CANDIDATE_SELECT)
    .eq('organization_id', orgId)
    .is('deleted_at' as never, null)
    .in('crm_modules.key', ['contacts', 'members']);

  const { data, error } = await applyFilters(base);
  if (error) {
    console.error('[resolveMemberCrmRecord] candidate query failed:', error.message);
    return [];
  }
  return (data ?? []) as RecordRow[];
}

/** Collect alternate emails stored on already-fetched twins (email2 / secondary). */
function alternateEmailsFromRows(rows: RecordRow[], exclude: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set(exclude);
  for (const row of rows) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    for (const key of ['email2', 'secondary_email', 'email'] as const) {
      const raw = data[key];
      if (typeof raw !== 'string') continue;
      const normalized = raw.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
    const indexed = (row.email ?? '').trim().toLowerCase();
    if (indexed && !seen.has(indexed)) {
      seen.add(indexed);
      out.push(indexed);
    }
  }
  return out;
}

/**
 * Enrollment twins often store the Zoho/work email as `email2` while billing
 * `members.email` is a portal address. Expand the candidate set using those
 * alternate emails so pickBest can prefer the rich Zoho contact.
 */
async function expandCandidatesViaAlternateEmails(
  supabase: SupabaseClient,
  orgId: string,
  seedRows: RecordRow[],
  knownEmails: Set<string>,
): Promise<RecordRow[]> {
  const alternates = alternateEmailsFromRows(seedRows, knownEmails);
  if (alternates.length === 0) return [];

  const expanded: RecordRow[] = [];
  for (const email of alternates) {
    expanded.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
        query.ilike('email', email),
      )),
    );
    expanded.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
        query.eq('data->>secondary_email', email),
      )),
    );
  }
  return expanded;
}

/** Resolve the best CRM record for one enrollment member using targeted lookups. */
export async function resolveMemberCrmRecordId(
  supabase: SupabaseClient,
  orgId: string,
  member: MemberCrmLookupInput,
): Promise<string | null> {
  const rows: RecordRow[] = [];

  rows.push(
    ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
      query.contains('data', { linked_member_id: member.id }),
    )),
  );

  const memberNumber = member.member_number?.trim();
  if (memberNumber) {
    rows.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
        query.eq('data->>member_number', memberNumber),
      )),
    );
  }

  const email = member.email?.trim();
  const knownEmails = new Set<string>();
  if (email) {
    knownEmails.add(email.toLowerCase());
    rows.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
        query.ilike('email', email),
      )),
    );
    rows.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
        query.eq('data->>secondary_email', email),
      )),
    );
    // Portal/hushmail primary on billing can match Zoho contact via email2 on
    // the members-module twin, or secondary_email on the Zoho contact after link.
    rows.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
        query.eq('data->>email2', email),
      )),
    );
  }

  rows.push(
    ...(await expandCandidatesViaAlternateEmails(supabase, orgId, rows, knownEmails)),
  );

  const best = pickBestMemberCrmRecord(member, dedupeCandidates(rows));
  return best?.id ?? null;
}

/** Batch-resolve CRM record ids for many members (members list API). */
export async function resolveMemberCrmRecordIds(
  supabase: SupabaseClient,
  orgId: string,
  members: MemberCrmLookupInput[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (members.length === 0) return out;

  const rows: RecordRow[] = [];
  const memberIds = members.map((m) => m.id);
  const memberNumbers = Array.from(
    new Set(members.map((m) => m.member_number?.trim()).filter((v): v is string => !!v)),
  );
  const emails = Array.from(
    new Set(members.map((m) => m.email?.trim().toLowerCase()).filter((v): v is string => !!v)),
  );

  if (memberIds.length > 0) {
    const linkedOr = memberIds
      .map((memberId) => `data.cs.${JSON.stringify({ linked_member_id: memberId })}`)
      .join(',');
    rows.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) => query.or(linkedOr))),
    );
  }

  for (const memberNumber of memberNumbers) {
    rows.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
        query.eq('data->>member_number', memberNumber),
      )),
    );
  }

  if (emails.length > 0) {
    const orClause = emails.map((e) => `email.ilike.${escapeIlikeExact(e)}`).join(',');
    rows.push(
      ...(await fetchContactModuleCandidates(supabase, orgId, (query) => query.or(orClause))),
    );
    for (const email of emails) {
      rows.push(
        ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
          query.eq('data->>secondary_email', email),
        )),
      );
      rows.push(
        ...(await fetchContactModuleCandidates(supabase, orgId, (query) =>
          query.eq('data->>email2', email),
        )),
      );
    }
  }

  rows.push(
    ...(await expandCandidatesViaAlternateEmails(
      supabase,
      orgId,
      rows,
      new Set(emails),
    )),
  );

  const candidates = dedupeCandidates(rows);
  for (const member of members) {
    const best = pickBestMemberCrmRecord(member, candidates);
    if (best?.id) out.set(member.id, best.id);
  }

  return out;
}

function escapeIlikeExact(value: string): string {
  return value
    .replace(/[\\%_]/g, '\\$&')
    .replace(/[\r\n,()]/g, '');
}
