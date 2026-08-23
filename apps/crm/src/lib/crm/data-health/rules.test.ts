import { describe, expect, it } from 'vitest';
import { RULE_CATALOG, computeScore } from './score';
import {
  DATA_HEALTH_RULES,
  PIFH_ORG_ID,
  SAMPLE_IDS_CAP,
  buildBookSizeSql,
  normalizeRuleRows,
  runRules,
} from './rules';
import type { RuleDef, SqlExecutor } from './types';

const ORG = PIFH_ORG_ID;

describe('data-health rule catalog', () => {
  it('implements exactly the RULE_CATALOG from score.ts, in order', () => {
    // Identity (keys, labels, severities) is single-sourced in score.ts —
    // this asserts the SQL side never drifts from it.
    expect(DATA_HEALTH_RULES.map((r) => r.key)).toEqual(RULE_CATALOG.map((r) => r.key));
    for (const [i, rule] of DATA_HEALTH_RULES.entries()) {
      expect(rule.label).toBe(RULE_CATALOG[i].label);
      expect(rule.severity).toBe(RULE_CATALOG[i].severity);
    }
    expect(new Set(DATA_HEALTH_RULES.map((r) => r.key)).size).toBe(DATA_HEALTH_RULES.length);
  });

  it('covers the full v1 rule list', () => {
    expect(DATA_HEALTH_RULES.map((r) => r.key).sort()).toEqual(
      [
        'completeness.member-core',
        'completeness.unreachable',
        'dates.impossible',
        'dates.pending-no-start',
        'dupes.open-pairs',
        'ingest.stuck-imports',
        'lifecycle.no-owner',
        'lifecycle.null-status',
        'lifecycle.stale-pending',
        'refs.linked-member',
        'refs.orphan-attachments',
        'refs.orphan-notes',
        'refs.orphan-tasks',
        'refs.trash-batch',
        'twins.contact-member',
        'vocabulary.producer',
        'vocabulary.product',
        'vocabulary.status',
      ].sort(),
    );
  });

  it('every rule has a plain-language label and a one-sentence describe', () => {
    for (const rule of DATA_HEALTH_RULES) {
      expect(rule.label.length, rule.key).toBeGreaterThan(10);
      expect(rule.describe.length, rule.key).toBeGreaterThan(30);
    }
  });

  it('EVERY generated query is pinned to the org', () => {
    const pin = new RegExp(`(org_id|organization_id) = '${ORG}'`);
    for (const rule of DATA_HEALTH_RULES) {
      expect(rule.buildSql(ORG), rule.key).toMatch(pin);
      if (rule.buildContextSql) {
        expect(rule.buildContextSql(ORG), `${rule.key} context`).toMatch(pin);
      }
    }
    expect(buildBookSizeSql(ORG)).toMatch(pin);
  });

  it('EVERY generated query is a read-only select', () => {
    const sqls = [
      buildBookSizeSql(ORG),
      ...DATA_HEALTH_RULES.flatMap((rule) => [
        rule.buildSql(ORG),
        ...(rule.buildContextSql ? [rule.buildContextSql(ORG)] : []),
      ]),
    ];
    for (const sql of sqls) {
      expect(sql.trim().toLowerCase().startsWith('select')).toBe(true);
      expect(sql).not.toMatch(/;/);
      expect(sql).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|grant|create)\b/i);
    }
  });

  it('refuses a non-UUID orgId (injection guard)', () => {
    for (const bad of ["x'; drop table crm_records; --", '', 'not-a-uuid', '1 or 1=1']) {
      expect(() => DATA_HEALTH_RULES[0].buildSql(bad)).toThrow(/UUID/);
    }
    expect(() => buildBookSizeSql('1 or 1=1')).toThrow(/UUID/);
  });

  it('sample queries project ids and a count only — never PII columns', () => {
    for (const rule of DATA_HEALTH_RULES) {
      expect(rule.buildSql(ORG)).toMatch(
        /^select q\.id::text as id, count\(\*\) over \(\) as total from \(/,
      );
    }
  });

  it('every sample query caps its rows in SQL, not only in the engine', () => {
    for (const rule of DATA_HEALTH_RULES) {
      expect(rule.buildSql(ORG), rule.key).toContain(`limit ${SAMPLE_IDS_CAP}`);
    }
  });

  it('a context query returns exactly one labelled number', () => {
    for (const rule of DATA_HEALTH_RULES) {
      if (!rule.buildContextSql) continue;
      expect(rule.contextLabel, `${rule.key} context needs a label`).toBeTruthy();
      expect(rule.buildContextSql(ORG), rule.key).toMatch(/^select count\(\*\) as value/);
    }
  });
});

/**
 * FIELD-CORRECTNESS REGRESSION PINS (formula v2, 2026-08-23).
 *
 * Every assertion here encodes a defect that was live in prod and was measured
 * against the real book — a rule whose SQL parsed cleanly while reading a
 * column that is not where its concept lives. These are not style checks: each
 * one names the false number it prevents from coming back.
 */
describe('data-health field correctness', () => {
  const sqlFor = (key: string) => {
    const rule = DATA_HEALTH_RULES.find((r) => r.key === key);
    if (!rule) throw new Error(`no rule ${key}`);
    return rule.buildSql(ORG);
  };
  const ruleFor = (key: string) => {
    const rule = DATA_HEALTH_RULES.find((r) => r.key === key);
    if (!rule) throw new Error(`no rule ${key}`);
    return rule;
  };

  it('member-core reads coverage from ENROLLMENTS, never members.effective_date (995 → 4)', () => {
    const sql = sqlFor('completeness.member-core');
    // members.effective_date is populated on 2 of 997 live members: reading it
    // reported 995 of 997 members as incomplete.
    expect(sql).not.toMatch(/m\.effective_date/);
    expect(sql).toContain('from enrollments e');
    expect(sql).toContain('e.effective_date is not null');
    // BOTH link paths — enrollment→member and member→primary enrollment.
    expect(sql).toContain('e.primary_member_id = m.id');
    expect(sql).toContain('e.id = m.primary_enrollment_id');
    expect(sql).toContain('m.merged_into_id is null');
  });

  it('no-owner reads the per-module owner keys this book actually uses (425 → 21)', () => {
    const sql = sqlFor('lifecycle.no-owner');
    // Leads store ownership in lead_owner, contacts in contact_owner; reading
    // only producer_name called an entire module ownerless.
    expect(sql).toContain("r.data->>'lead_owner'");
    expect(sql).toContain("r.data->>'contact_owner'");
    expect(sql).toContain('r.normalized_advisor_name');
    expect(sql).toContain('r.normalized_agent_name');
    // An advisors/accounts row having "no owner" is a category error.
    expect(sql).toContain("m.key in ('contacts', 'leads', 'members')");
  });

  it('producer matches composite advisor names and counts spellings, not records (785 → 20)', () => {
    const sql = sqlFor('vocabulary.producer');
    // advisors.full_name is "Person - Company"; first_name/last_name are a
    // naive split of it and add no match an exact full_name check did not.
    expect(sql).toContain("split_part(a.full_name, '-', 1)");
    expect(sql).not.toMatch(/a\.first_name/);
    expect(sql).not.toMatch(/a\.last_name/);
    // Attribution runs on canonical_advisor_id — an already-linked record is
    // not an attribution gap.
    expect(sql).toContain('r.canonical_advisor_id is null');
    // One row per SPELLING (the fixable unit), records go in the context.
    expect(sql).toMatch(/group by /);
    expect(ruleFor('vocabulary.producer').buildContextSql).toBeTypeOf('function');
  });

  it('stale-pending measures dwell on stage_updated_at, not the mass-reset updated_at (0 → 41)', () => {
    const sql = sqlFor('lifecycle.stale-pending');
    expect(sql).toContain('coalesce(r.stage_updated_at, r.created_at)');
    // updated_at was restamped book-wide by the August backfill, so it can
    // never satisfy the 45-day predicate.
    expect(sql).not.toMatch(/r\.updated_at\s*</);
  });

  it('orphan rules never treat a NULL record_id as a broken reference (3 → 0)', () => {
    for (const key of ['refs.orphan-notes', 'refs.orphan-tasks', 'refs.orphan-attachments']) {
      const sql = sqlFor(key);
      // crm_tasks.record_id is nullable BY DESIGN — a standalone task is a
      // product feature, not a dangling foreign key.
      expect(sql, key).toContain('n.record_id is not null');
      expect(sql, key).not.toMatch(/n\.record_id is null/);
      // The parent must belong to this org: fail closed on a cross-tenant id.
      expect(sql, key).toMatch(/r\.org_id = '[0-9a-f-]+'\)/);
    }
  });

  it('trash-batch counts trashed records with no restorable batch, not an unreachable join (0 → 2)', () => {
    const sql = sqlFor('refs.trash-batch');
    // delete_batch_id is 0% populated and crm_trash_batches is empty, so the
    // old predicate could only ever return 0.
    expect(sql).toContain('r.deleted_at is not null');
    expect(sql).toContain('r.delete_batch_id is null');
    expect(sql).toContain("coalesce(r.deleted_origin, '') <> 'merge'");
    expect(ruleFor('refs.trash-batch').contextLabel).toMatch(/merge/i);
  });

  it('twins compare identity FAMILIES, so a second phone or email is not drift (128 → 64)', () => {
    const sql = sqlFor('twins.contact-member');
    for (const key of ['email2', 'secondary_email', 'phone2', 'mobile']) {
      expect(sql, key).toContain(`'${key}'`);
    }
    // Set overlap, not slot-to-slot equality.
    expect(sql).toContain('p.m_emails && p.c_emails');
    expect(sql).toContain('p.m_phones && p.c_phones');
    // A shortened first name is not a conflict anyone can act on.
    expect(sql).toContain('left(p.m_first');
  });

  it('impossible dates read coverage from enrollments and drop the legacy start-date legs', () => {
    const sql = sqlFor('dates.impossible');
    expect(sql).toContain('from enrollments e');
    expect(sql).not.toMatch(/m\.effective_date/);
    // original_start_date is the PRE-RENEWAL start; comparing it to a
    // dependent's DOB flagged a placeholder-DOB cluster as a date conflict.
    expect(sql).not.toMatch(/original_start_date/);
    expect(sql).not.toMatch(/current_year_start_date/);
  });

  it('unreachable guards the second-email key this book actually uses (66 → 65)', () => {
    const sql = sqlFor('completeness.unreachable');
    // secondary_email: 1,262 contacts. email2: 29.
    expect(sql).toContain("r.data->>'secondary_email'");
    expect(sql).toContain("r.data->>'work_phone'");
  });

  it('linked-member fails closed on a link into another tenant', () => {
    expect(sqlFor('refs.linked-member')).toContain('mm.organization_id = r.org_id');
  });

  it('stuck-imports mirrors the reaper: import kinds only, heartbeat, reachable window', () => {
    const sql = sqlFor('ingest.stuck-imports');
    // data_job rows wait on human approval by design.
    expect(sql).toContain("j.source_type in ('csv', 'csv_upload', 'csv_update', 'export', 'zoho')");
    expect(sql).toContain("j.stats->>'last_pass_at'");
    // 24h was unreachable behind a */15 reaper that terminalizes after 1h.
    expect(sql).not.toMatch(/24 hours/);
    expect(ruleFor('ingest.stuck-imports').buildContextSql).toBeTypeOf('function');
  });

  it('product options are read from BOTH shapes, and the label admits no list exists', () => {
    const rule = ruleFor('vocabulary.product');
    const sql = rule.buildSql(ORG);
    // Options are persisted as {label, value} objects; jsonb_array_elements_text
    // over those yields serialized JSON that can never equal a record's value.
    expect(sql).toContain("e->>'value'");
    expect(sql).not.toMatch(/jsonb_array_elements_text\(f\.options\)/);
    // jsonb_array_length throws on a scalar — the guard must be a CASE, since
    // Postgres does not short-circuit AND.
    expect(rule.buildContextSql?.(ORG)).toMatch(/case when jsonb_typeof/);
    // A rule that cannot currently detect anything must not read as a pass.
    expect(rule.label.toLowerCase()).toContain('no list curated');
    expect(rule.contextLabel).toBeTruthy();
  });

  it('null-status sweeps every module, as its SQL always did (4 → 5)', () => {
    const sql = sqlFor('lifecycle.null-status');
    expect(sql).not.toMatch(/crm_modules/);
  });

  it('labels never promise more than the count delivers', () => {
    const label = (key: string) => ruleFor(key).label;
    expect(label('completeness.member-core')).not.toMatch(/effective date/i);
    expect(label('vocabulary.producer')).toMatch(/spelling/i);
    expect(label('refs.trash-batch')).toMatch(/restorable/i);
    expect(label('lifecycle.null-status')).toMatch(/blank status/i);
    expect(label('ingest.stuck-imports')).not.toMatch(/day/i);
  });
});

describe('normalizeRuleRows', () => {
  const rule: RuleDef = DATA_HEALTH_RULES[0];

  it('reads the window count and collects ids', () => {
    const result = normalizeRuleRows(rule, [
      { id: 'a', total: '3' },
      { id: 'b', total: 3 },
      { id: 'c', total: 3 },
    ]);
    expect(result.count).toBe(3);
    expect(result.sampleIds).toEqual(['a', 'b', 'c']);
    expect(result.severity).toBe(rule.severity);
  });

  it('caps sampleIds at 20 even if the executor returns more', () => {
    const rows = Array.from({ length: 35 }, (_, i) => ({ id: `id-${i}`, total: 35 }));
    const result = normalizeRuleRows(rule, rows);
    expect(result.sampleIds).toHaveLength(SAMPLE_IDS_CAP);
    expect(result.count).toBe(35);
  });

  it('drops null/duplicate ids and survives an empty result', () => {
    expect(normalizeRuleRows(rule, [])).toMatchObject({ count: 0, sampleIds: [] });
    const result = normalizeRuleRows(rule, [
      { id: null, total: 2 },
      { id: 'a', total: 2 },
      { id: 'a', total: 2 },
    ]);
    expect(result.sampleIds).toEqual(['a']);
  });

  it('treats a broken total as 0 rather than NaN-ing the score', () => {
    expect(normalizeRuleRows(rule, [{ id: 'a', total: 'garbage' }]).count).toBe(0);
    expect(normalizeRuleRows(rule, [{ id: 'a', total: -4 }]).count).toBe(0);
  });
});

describe('runRules', () => {
  it('runs the whole catalog through the injected executor and scores it', async () => {
    const seen: string[] = [];
    const executor: SqlExecutor = async (sql) => {
      seen.push(sql);
      if (sql.startsWith('select count(*) as total from crm_records')) {
        return [{ total: 1000 }];
      }
      if (sql.includes('crm_duplicate_dismissals')) return [{ value: 7 }];
      if (sql.includes('crm_probable_duplicates')) {
        return [
          { id: 'dupe-1', total: 2 },
          { id: 'dupe-2', total: 2 },
        ];
      }
      return [];
    };

    const report = await runRules(executor);
    expect(report.version).toBe(1);
    expect(report.orgId).toBe(PIFH_ORG_ID);
    expect(report.bookSize).toBe(1000);
    expect(report.errors).toEqual([]);
    expect(report.rules).toHaveLength(DATA_HEALTH_RULES.length);

    const dupes = report.rules.find((r) => r.key === 'dupes.open-pairs');
    expect(dupes).toMatchObject({
      count: 2,
      sampleIds: ['dupe-1', 'dupe-2'],
      context: { label: 'Dismissed pairs', value: 7 },
    });

    // The report's score IS computeScore over its counts — never a fork.
    expect(report.score).toBe(
      computeScore(Object.fromEntries(report.rules.map((r) => [r.key, r.count]))),
    );
    expect(report.score).toBeLessThan(100);
    // book size + one query per rule + one query per rule that carries context
    const withContext = DATA_HEALTH_RULES.filter((r) => r.buildContextSql).length;
    expect(withContext).toBeGreaterThan(0);
    expect(seen).toHaveLength(1 + DATA_HEALTH_RULES.length + withContext);
  });

  it('a rule that throws lands in errors without killing the sweep', async () => {
    const executor: SqlExecutor = async (sql) => {
      if (sql.includes('crm_probable_duplicates')) {
        throw new Error('statement timeout');
      }
      if (sql.startsWith('select count(*) as total')) return [{ total: 100 }];
      return [];
    };
    const report = await runRules(executor);
    expect(report.errors).toEqual([{ key: 'dupes.open-pairs', message: 'statement timeout' }]);
    expect(report.rules).toHaveLength(DATA_HEALTH_RULES.length - 1);
    expect(report.score).toBe(100);
  });

  it('rejects a non-UUID org before touching the executor', async () => {
    const executor: SqlExecutor = async () => {
      throw new Error('must not run');
    };
    await expect(runRules(executor, { orgId: 'evil' })).rejects.toThrow(/UUID/);
  });

  it('stamps generatedAt from the injected clock', async () => {
    const executor: SqlExecutor = async () => [];
    const report = await runRules(executor, {
      now: () => new Date('2026-08-23T00:00:00.000Z'),
    });
    expect(report.generatedAt).toBe('2026-08-23T00:00:00.000Z');
  });
});
