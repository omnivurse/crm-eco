import { describe, expect, it } from 'vitest';
import {
  buildUpdatePayload,
  extractMatchKeys,
  filterKeysByPriority,
  nameDobKey,
  normalizeDobForMatch,
  parseCsv,
  DEFAULT_MATCH_PRIORITY,
} from './csv-update';
import {
  runCsvUpdate,
  type CsvUpdateWriter,
  type MatchableRecord,
  type RecordLookup,
} from './run-csv-update';

function rec(
  partial: Partial<MatchableRecord> & { id: string },
): MatchableRecord {
  return {
    title: partial.title ?? null,
    email: partial.email ?? null,
    phone: partial.phone ?? null,
    status: partial.status ?? null,
    stage: partial.stage ?? null,
    data: partial.data ?? {},
    ...partial,
  };
}

function memoryLookup(records: MatchableRecord[]): RecordLookup {
  return {
    async findByZohoIds(ids) {
      const set = new Set(ids);
      return records.filter((r) => {
        const z = (r.data || {}).zoho_id;
        return z != null && set.has(String(z));
      });
    },
    async findByEmails(emails) {
      const set = new Set(emails.map((e) => e.toLowerCase()));
      return records.filter(
        (r) => r.email && set.has(r.email.toLowerCase()),
      );
    },
    async findByPhones(phones) {
      const set = new Set(phones);
      return records.filter((r) => {
        const digits = String(r.phone || '').replace(/\D/g, '');
        return set.has(digits);
      });
    },
    async findByNameDobs(keys) {
      const set = new Set(keys);
      return records.filter((r) => {
        const d = (r.data || {}) as Record<string, unknown>;
        const k = nameDobKey(d.first_name, d.last_name, d.date_of_birth);
        return k != null && set.has(k);
      });
    },
  };
}

function memoryWriter(
  applied: Array<{ id: string; patch: Record<string, unknown> }>,
): CsvUpdateWriter {
  const store = applied;
  return {
    async createJob() {
      return { id: 'job-1' };
    },
    async applyUpdate(target) {
      store.push({ id: target.recordId, patch: target.patch });
      return { ok: true };
    },
    async completeJob() {},
    async audit() {},
  };
}

describe('csv-update pure helpers', () => {
  it('parses quoted CSV and extracts match keys including name_dob', () => {
    const csv = [
      'Zoho ID,Email,First Name,Last Name,Date of Birth,Phone,Status',
      '"z-1","a@x.com","Jane","Doe","01/15/1990","(303) 555-1212","Active"',
    ].join('\n');
    const parsed = parseCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    const keys = extractMatchKeys(parsed.rows[0].normalized);
    expect(keys.zoho_id).toBe('z-1');
    expect(keys.email).toBe('a@x.com');
    expect(keys.phone).toBe('3035551212');
    expect(keys.name_dob).toBe('jane|doe|1990-01-15');
  });

  it('normalizes DOB formats', () => {
    expect(normalizeDobForMatch('1990-01-15')).toBe('1990-01-15');
    expect(normalizeDobForMatch('1/15/1990')).toBe('1990-01-15');
    expect(normalizeDobForMatch('')).toBeNull();
  });

  it('filterKeysByPriority keeps only the highest available key', () => {
    const keys = extractMatchKeys({
      zoho_id: 'z',
      email: 'a@x.com',
      phone: '3035551212',
      first_name: 'Jane',
      last_name: 'Doe',
      date_of_birth: '1990-01-15',
    });
    expect(filterKeysByPriority(keys, DEFAULT_MATCH_PRIORITY)).toEqual({
      zoho_id: 'z',
    });
    expect(
      filterKeysByPriority(keys, ['email', 'phone', 'name_dob', 'zoho_id']),
    ).toEqual({ email: 'a@x.com' });
  });

  it('buildUpdatePayload never overwrites with blanks by default', () => {
    const payload = buildUpdatePayload(
      {
        title: 'Old',
        email: 'old@x.com',
        phone: '111',
        status: 'Active',
        stage: null,
        data: { city: 'Denver' },
      },
      {
        index: 0,
        raw: {},
        normalized: { email: 'new@x.com', city: '' },
        keys: { email: 'new@x.com' },
      },
    );
    expect(payload.columns.email).toBe('new@x.com');
    expect(payload.mergedData.city).toBe('Denver');
  });
});

describe('runCsvUpdate', () => {
  it('dry-run matches by email and reports field deltas without writing', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          title: 'Ann',
          data: { email: 'a@x.com', city: 'Austin' },
        }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', city: 'Dallas', title: 'Ann X' },
        },
      ],
    });

    expect(result.dryRun).toBe(true);
    expect(result.matched).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.matchSummary.byEmail).toBe(1);
    expect(result.previewMatches[0]?.fieldDelta.city?.to).toBe('Dallas');
    expect(applied).toHaveLength(0);
  });

  it('applies updates only to matched rows', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          title: 'Ann',
          data: { email: 'a@x.com' },
        }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', title: 'Ann Updated' },
        },
        {
          index: 1,
          raw: {},
          normalized: { email: 'nobody@x.com', title: 'Ghost' },
        },
      ],
    });

    expect(result.matched).toBe(1);
    expect(result.unmatched).toBe(1);
    expect(result.updated).toBe(1);
    expect(applied).toHaveLength(1);
    expect(applied[0].id).toBe('r1');
    expect(applied[0].patch.title).toBe('Ann Updated');
  });

  it('fails closed on ambiguous email matches', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'dup@x.com', data: {} }),
        rec({ id: 'r2', email: 'dup@x.com', data: {} }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'dup@x.com', title: 'Nope' },
        },
      ],
    });

    expect(result.matched).toBe(0);
    expect(result.ambiguous).toBe(1);
    expect(result.previewAmbiguous[0]?.matchedBy).toBe('email');
    expect(result.previewAmbiguous[0]?.candidateCount).toBe(2);
    expect(applied).toHaveLength(0);
  });

  it('matches by name + DOB when higher keys are absent', async () => {
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          data: {
            first_name: 'Jane',
            last_name: 'Doe',
            date_of_birth: '1990-01-15',
            city: 'Old',
          },
        }),
      ]),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: {
            first_name: 'Jane',
            last_name: 'Doe',
            date_of_birth: '1/15/1990',
            city: 'New',
          },
        },
      ],
    });

    expect(result.matched).toBe(1);
    expect(result.matchSummary.byNameDob).toBe(1);
    expect(result.previewMatches[0]?.fieldDelta.city?.to).toBe('New');
  });

  it('counts unchanged when CSV values already match', async () => {
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          title: 'Same',
          data: { email: 'a@x.com', title: 'Same' },
        }),
      ]),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', title: 'Same' },
        },
      ],
    });

    expect(result.matched).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.previewMatches).toHaveLength(0);
  });

  it('allows non-empty status from CSV in the payload columns', () => {
    const payload = buildUpdatePayload(
      {
        title: 'T',
        email: 'a@x.com',
        phone: null,
        status: 'Pending',
        stage: null,
        data: {},
      },
      {
        index: 0,
        raw: {},
        normalized: { email: 'a@x.com', status: 'Active' },
        keys: { email: 'a@x.com' },
      },
    );
    expect(payload.columns.status).toBe('Active');
  });
});
