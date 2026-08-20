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
  type CsvUpdateWriteTarget,
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
    updated_at: partial.updated_at ?? '2026-08-01T00:00:00+00:00',
    ...partial,
  };
}

function memoryLookup(
  records: MatchableRecord[],
  opts: {
    /** Mimic crm_phone_lookup returning a projected data stub, not the blob. */
    phoneStubs?: boolean;
    /** Mimic records trashed between phone lookup and findByIds re-fetch. */
    hiddenFromFindByIds?: Set<string>;
  } = {},
): RecordLookup {
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
      // Loose candidate collection, like the real RPC: substring hits over
      // every phone-ish field, tagged with the requested phone.
      const out: Array<{ phone: string; record: MatchableRecord }> = [];
      for (const r of records) {
        const d = (r.data || {}) as Record<string, unknown>;
        const numbers = [r.phone, d.phone, d.mobile, d.cell, d.work_phone, d.home_phone]
          .filter((v) => v != null)
          .map((v) => String(v).replace(/\D/g, ''));
        for (const p of phones) {
          const hit = numbers.some(
            (digits) =>
              digits.includes(p) ||
              p.includes(digits) ||
              (digits.length >= 10 &&
                p.length >= 10 &&
                digits.slice(-10) === p.slice(-10)),
          );
          if (!hit) continue;
          const record = opts.phoneStubs
            ? {
                ...r,
                data: {
                  first_name:
                    ((r.data || {}) as Record<string, unknown>).first_name ??
                    null,
                },
              }
            : r;
          out.push({ phone: p, record });
        }
      }
      return out;
    },
    async findByNameDobs(keys) {
      const set = new Set(keys);
      return records.filter((r) => {
        const d = (r.data || {}) as Record<string, unknown>;
        const k = nameDobKey(d.first_name, d.last_name, d.date_of_birth);
        return k != null && set.has(k);
      });
    },
    async findByIds(ids) {
      const set = new Set(ids);
      return records.filter(
        (r) => set.has(r.id) && !opts.hiddenFromFindByIds?.has(r.id),
      );
    },
  };
}

function memoryWriter(
  applied: Array<{ id: string; patch: Record<string, unknown> }>,
  ledger: CsvUpdateWriteTarget[] = [],
  opts: { failLedger?: boolean } = {},
): CsvUpdateWriter {
  const store = applied;
  let seq = 0;
  return {
    async createJob() {
      return { id: 'job-1' };
    },
    async recordLedgerEntry({ target }) {
      if (opts.failLedger) {
        return { ok: false, error: 'ledger unavailable' };
      }
      ledger.push(target);
      seq += 1;
      return { ok: true, id: `ledger-${seq}` };
    },
    async finalizeLedgerEntry() {
        return { ok: true };
      },
    async applyUpdate(target) {
      store.push({ id: target.recordId, patch: target.patch });
      return { ok: true };
    },
    async completeJob() {},
    async audit() {
      return { ok: true };
    },
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

describe('runCsvUpdate safety hardening', () => {
  it('re-fetches full records for phone matches so a lookup stub cannot wipe the data blob', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const full = rec({
      id: 'r1',
      phone: '(303) 555-1212',
      data: {
        first_name: 'Jane',
        last_name: 'Doe',
        premium: 450,
        plan: 'Gold',
        zoho_id: 'z9',
      },
    });
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([full], { phoneStubs: true }),
      writer: memoryWriter(applied),
      rows: [
        { index: 0, raw: {}, normalized: { phone: '3035551212', city: 'Denver' } },
      ],
    });

    expect(result.updated).toBe(1);
    const data = applied[0].patch.data as Record<string, unknown>;
    expect(data.plan).toBe('Gold');
    expect(data.premium).toBe(450);
    expect(data.zoho_id).toBe('z9');
    expect(data.city).toBe('Denver');
  });

  it('drops phone matches whose record findByIds no longer returns (trashed since)', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup(
        [rec({ id: 'r1', phone: '3035551212', data: { plan: 'Gold' } })],
        { phoneStubs: true, hiddenFromFindByIds: new Set(['r1']) },
      ),
      writer: memoryWriter(applied),
      rows: [
        { index: 0, raw: {}, normalized: { phone: '3035551212', city: 'Denver' } },
      ],
    });

    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(1);
    expect(applied).toHaveLength(0);
  });

  it('matches an 11-digit stored phone against a 10-digit CSV phone (tail-10)', async () => {
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({ id: 'r1', phone: '1-303-555-1212', data: { city: 'Old' } }),
      ]),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { phone: '(303) 555-1212', city: 'New' },
        },
      ],
    });

    expect(result.matched).toBe(1);
    expect(result.matchSummary.byPhone).toBe(1);
  });

  it('fails closed when multiple file rows resolve to the same record', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const shared = rec({
      id: 'r1',
      email: 'family@x.com',
      data: { zoho_id: 'z1' },
    });
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([shared]),
      writer: memoryWriter(applied),
      rows: [
        { index: 0, raw: {}, normalized: { zoho_id: 'z1', city: 'A' } },
        { index: 1, raw: {}, normalized: { email: 'family@x.com', city: 'B' } },
      ],
    });

    expect(result.duplicateTarget).toBe(2);
    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(0);
    expect(result.previewDuplicateTarget).toHaveLength(2);
    expect(result.previewDuplicateTarget[0]?.recordId).toBe('r1');
    expect(applied).toHaveLength(0);
  });

  it('reports mid-apply conflicts separately from errors', async () => {
    const conflictWriter: CsvUpdateWriter = {
      async createJob() {
        return { id: 'job-1' };
      },
      async recordLedgerEntry() {
        return { ok: true, id: 'ledger-1' };
      },
      async finalizeLedgerEntry() {
        return { ok: true };
      },
      async applyUpdate() {
        return { ok: false, conflict: true };
      },
      async completeJob() {},
      async audit() {
        return { ok: true };
      },
    };
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'a@x.com', data: {} }),
      ]),
      writer: conflictWriter,
      rows: [
        { index: 0, raw: {}, normalized: { email: 'a@x.com', city: 'Dallas' } },
      ],
    });

    expect(result.conflicts).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.previewConflicts[0]?.recordId).toBe('r1');
  });

  it('threads the matched updated_at into the write target', async () => {
    const targets: string[] = [];
    const captureWriter: CsvUpdateWriter = {
      async createJob() {
        return { id: 'job-1' };
      },
      async recordLedgerEntry() {
        return { ok: true, id: 'ledger-1' };
      },
      async finalizeLedgerEntry() {
        return { ok: true };
      },
      async applyUpdate(target) {
        targets.push(String(target.expectedUpdatedAt));
        return { ok: true };
      },
      async completeJob() {},
      async audit() {
        return { ok: true };
      },
    };
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          updated_at: '2026-08-19T12:00:00+00:00',
          data: {},
        }),
      ]),
      writer: captureWriter,
      rows: [
        { index: 0, raw: {}, normalized: { email: 'a@x.com', city: 'Dallas' } },
      ],
    });

    expect(targets).toEqual(['2026-08-19T12:00:00+00:00']);
  });

  it('does not report formatting drift as a change', async () => {
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          data: {
            email: 'a@x.com',
            effective_date: '2026-06-01',
            premium: 450,
            tobacco_user: false,
          },
        }),
      ]),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: {
            email: 'a@x.com',
            effective_date: '06/01/2026',
            premium: '$450.00',
            tobacco_user: 'No',
          },
        },
      ],
    });

    expect(result.matched).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.previewMatches).toHaveLength(0);
  });

  it('writes real differences with the stored type preserved', () => {
    const payload = buildUpdatePayload(
      {
        title: null,
        email: 'a@x.com',
        phone: null,
        status: null,
        stage: null,
        data: { premium: 450, tobacco_user: false, effective_date: '2026-06-01' },
      },
      {
        index: 0,
        raw: {},
        normalized: {
          premium: '$475.50',
          tobacco_user: 'Yes',
          effective_date: '7/1/2026',
        },
        keys: { email: 'a@x.com' },
      },
    );

    expect(payload.mergedData.premium).toBe(475.5);
    expect(payload.mergedData.tobacco_user).toBe(true);
    expect(payload.mergedData.effective_date).toBe('2026-07-01');
    expect(payload.delta.premium).toEqual({ from: 450, to: 475.5 });
  });

  it('skips unparseable date values instead of clobbering the stored date', async () => {
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          data: { email: 'a@x.com', effective_date: '2026-06-01' },
        }),
      ]),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', effective_date: 'garbage' },
        },
      ],
    });

    expect(result.invalidValues).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.previewMatches).toHaveLength(0);
  });

  it('never writes protected keys (notes / authorship / identifiers) from the file', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([rec({ id: 'r1', email: 'a@x.com', data: {} })]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: {
            email: 'a@x.com',
            city: 'Dallas',
            notes: 'imported note dump',
            notes_history: '<div>blob</div>',
            created_by: 'someone-else',
            owner_id: 'hijack',
          },
        },
      ],
    });

    expect(applied).toHaveLength(1);
    const data = applied[0].patch.data as Record<string, unknown>;
    expect(data.city).toBe('Dallas');
    expect(data.notes).toBeUndefined();
    expect(data.notes_history).toBeUndefined();
    expect(data.created_by).toBeUndefined();
    expect(applied[0].patch.owner_id).toBeUndefined();
  });

  it('pivots 2-digit DOB years like the write path and rejects garbage', () => {
    expect(normalizeDobForMatch('1/15/90')).toBe('1990-01-15');
    expect(normalizeDobForMatch('6/1/26')).toBe('2026-06-01');
    expect(normalizeDobForMatch('1990-01-15')).toBe('1990-01-15');
    expect(normalizeDobForMatch('01-Jun-1980')).toBeNull();
    expect(normalizeDobForMatch('')).toBeNull();
  });

  it('fails closed when a household shares the number across different phone fields', async () => {
    // Husband holds the number in the phone column; wife only in home_phone.
    // The real RPC returns both as candidates but its stub hides home_phone —
    // verification against FULL rows must surface the ambiguity.
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup(
        [
          rec({ id: 'husband', phone: '3035551212', data: {} }),
          rec({ id: 'wife', phone: null, data: { home_phone: '(303) 555-1212' } }),
        ],
        { phoneStubs: true },
      ),
      writer: memoryWriter(applied),
      rows: [
        { index: 0, raw: {}, normalized: { phone: '3035551212', city: 'Denver' } },
      ],
    });

    expect(result.ambiguous).toBe(1);
    expect(result.matched).toBe(0);
    expect(applied).toHaveLength(0);
  });

  it('preserves untouched legacy values verbatim — sanitize runs only on changed keys', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          data: {
            email: 'a@x.com',
            // Legacy hand-entered value the modern normalizer would null out.
            sharing_effective_date: 'June 1, 2024',
            city: 'Old',
          },
        }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        { index: 0, raw: {}, normalized: { email: 'a@x.com', city: 'New' } },
      ],
    });

    expect(applied).toHaveLength(1);
    const data = applied[0].patch.data as Record<string, unknown>;
    expect(data.city).toBe('New');
    expect(data.sharing_effective_date).toBe('June 1, 2024');
  });

  it('never lets a scalar CSV cell replace a stored array or object', () => {
    const payload = buildUpdatePayload(
      {
        title: null,
        email: 'a@x.com',
        phone: null,
        status: null,
        stage: null,
        data: { tag: ['Medi-Share', 'Renewal'], meta: { source: 'zoho' } },
      },
      {
        index: 0,
        raw: {},
        normalized: { tag: 'Medi-Share;Renewal', meta: 'stuff' },
        keys: { email: 'a@x.com' },
      },
    );
    expect(payload.mergedData.tag).toEqual(['Medi-Share', 'Renewal']);
    expect(payload.mergedData.meta).toEqual({ source: 'zoho' });
    expect(payload.invalidKeys.sort()).toEqual(['meta', 'tag']);
  });

  it('does not treat a case-only email difference as a change', async () => {
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'John.Smith@Gmail.com',
          data: { email: 'John.Smith@Gmail.com' },
        }),
      ]),
      rows: [
        { index: 0, raw: {}, normalized: { email: 'john.smith@gmail.com' } },
      ],
    });

    expect(result.matched).toBe(1);
    expect(result.unchanged).toBe(1);
  });

  it('flags rows whose record was edited after the file was exported (still applied)', async () => {
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: true,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          updated_at: '2026-08-15T09:00:00+00:00',
          data: { email: 'a@x.com', city: 'Old' },
        }),
      ]),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: {
            email: 'a@x.com',
            city: 'New',
            modified_time: '2026-07-01 14:32:05',
          },
        },
      ],
    });

    expect(result.crmNewer).toBe(1);
    expect(result.previewCrmNewer[0]).toMatchObject({
      recordId: 'r1',
      fileModified: '2026-07-01',
      recordUpdated: '2026-08-15',
    });
    // Informational only — the row still counts as a change to apply.
    expect(result.matched).toBe(1);
    expect(result.unchanged).toBe(0);
  });

  it('does not recompute derived date columns the file never named', async () => {
    // start_date changes; the record ALREADY has its own original_start_date.
    // Re-deriving it from start_date would silently rewrite the column the
    // pending→active cron reads.
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          data: {
            email: 'a@x.com',
            start_date: '2020-01-01',
            original_start_date: '2019-05-01',
            current_year_start_date: '2019-05-01',
          },
        }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', start_date: '1/1/2021' },
        },
      ],
    });

    expect(applied).toHaveLength(1);
    expect(applied[0].patch.original_start_date).toBeUndefined();
    expect(applied[0].patch.current_year_start_date).toBeUndefined();
    const data = applied[0].patch.data as Record<string, unknown>;
    expect(data.start_date).toBe('2021-01-01');
    expect(data.original_start_date).toBe('2019-05-01');
  });

  it('still fills a derived date column when the record has none', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'a@x.com', data: { email: 'a@x.com' } }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', start_date: '1/1/2021' },
        },
      ],
    });

    expect(applied[0].patch.original_start_date).toBe('2021-01-01');
  });

  it('updates the title column when a name part changes without a Name column', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          title: 'John Smith',
          data: { email: 'a@x.com', first_name: 'John', last_name: 'Smith' },
        }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', last_name: 'Smyth' },
        },
      ],
    });

    expect(applied[0].patch.title).toBe('John Smyth');
  });

  it('fails a phone closed when the lookup reports a saturated result set', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const saturatedLookup: RecordLookup = {
      ...memoryLookup([rec({ id: 'r1', phone: '3035551212', data: {} })]),
      async findByPhones(phones) {
        return phones.map((phone) => ({
          phone,
          record: rec({ id: 'r1', phone: '3035551212', data: {} }),
          saturated: true,
        }));
      },
    };
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: saturatedLookup,
      writer: memoryWriter(applied),
      rows: [
        { index: 0, raw: {}, normalized: { phone: '3035551212', city: 'Denver' } },
      ],
    });

    expect(result.ambiguous).toBe(1);
    expect(result.matched).toBe(0);
    expect(applied).toHaveLength(0);
  });

  it('reports only ATTEMPTED rows when the apply crashes midway', async () => {
    let calls = 0;
    let completed: { writeAttemptCount: number; updated: number } | null = null;
    const crashingWriter: CsvUpdateWriter = {
      async createJob() {
        return { id: 'job-1' };
      },
      async recordLedgerEntry() {
        return { ok: true, id: `ledger-${calls}` };
      },
      async finalizeLedgerEntry() {
        return { ok: true };
      },
      async applyUpdate() {
        calls++;
        if (calls === 2) throw new Error('connection reset');
        return { ok: true };
      },
      async completeJob(input) {
        completed = input;
      },
      async audit() {
        return { ok: true };
      },
    };

    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'a@x.com', data: {} }),
        rec({ id: 'r2', email: 'b@x.com', data: {} }),
        rec({ id: 'r3', email: 'c@x.com', data: {} }),
      ]),
      writer: crashingWriter,
      rows: [
        { index: 0, raw: {}, normalized: { email: 'a@x.com', city: 'A' } },
        { index: 1, raw: {}, normalized: { email: 'b@x.com', city: 'B' } },
        { index: 2, raw: {}, normalized: { email: 'c@x.com', city: 'C' } },
      ],
    });

    // The job must not claim all 3 rows were processed.
    expect(completed?.writeAttemptCount).toBe(2);
    expect(completed?.updated).toBe(1);
    expect(result.errors.some((e) => e.rowIndex === -1)).toBe(true);
  });

  it('lets a contact_status change reach the status column (stale stored status must not override)', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          status: 'Active',
          data: {
            email: 'a@x.com',
            status: 'Active',
            contact_status: 'Active',
          },
        }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', contact_status: 'Cancelled' },
        },
      ],
    });

    expect(applied[0].patch.status).toBe('Cancelled');
  });

  it('does not re-open a converted lead from a file carrying only contact_status', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    await runCsvUpdate({
      moduleKey: 'leads',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          status: 'Converted',
          data: {
            email: 'a@x.com',
            lead_status: 'Converted',
            contact_status: 'In Process',
          },
        }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', contact_status: 'Active' },
        },
      ],
    });

    expect(applied[0].patch.status).toBe('Converted');
  });

  it('never stores exporter bookkeeping columns, so an otherwise-identical file is a true no-op', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          data: { email: 'a@x.com', city: 'Denver' },
        }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: {
            email: 'a@x.com',
            city: 'Denver',
            modified_time: '2026-08-19 11:04:00',
            created_time: '2019-02-02 08:00:00',
          },
        },
      ],
    });

    expect(result.unchanged).toBe(1);
    expect(result.updated).toBe(0);
    expect(applied).toHaveLength(0);
  });

  it('records a before-image for every write, capturing prior values of exactly the changed keys', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const ledger: CsvUpdateWriteTarget[] = [];
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({
          id: 'r1',
          email: 'a@x.com',
          title: 'Ann',
          data: { email: 'a@x.com', city: 'Austin', plan: 'Gold' },
        }),
      ]),
      writer: memoryWriter(applied, ledger),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', city: 'Dallas' },
        },
      ],
    });

    expect(ledger).toHaveLength(1);
    expect(ledger[0].beforePatch.data.city).toBe('Austin');
    expect(ledger[0].appliedPatch.data.city).toBe('Dallas');
    // Untouched keys must not appear in the before-image at all.
    expect(ledger[0].beforePatch.data.plan).toBeUndefined();
    expect(ledger[0].expectedUpdatedAt).toBe('2026-08-01T00:00:00+00:00');
  });

  it('records the before-image BEFORE writing, and skips the write if it cannot', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'a@x.com', data: { email: 'a@x.com' } }),
      ]),
      writer: memoryWriter(applied, [], { failLedger: true }),
      rows: [
        { index: 0, raw: {}, normalized: { email: 'a@x.com', city: 'Dallas' } },
      ],
    });

    // An un-undoable update is worse than a skipped one.
    expect(applied).toHaveLength(0);
    expect(result.updated).toBe(0);
    expect(result.errors[0]?.error).toMatch(/could not record an undo entry/);
  });

  it('captures a null before-value for a key the record did not previously have', async () => {
    const ledger: CsvUpdateWriteTarget[] = [];
    await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'a@x.com', data: { email: 'a@x.com' } }),
      ]),
      writer: memoryWriter([], ledger),
      rows: [
        {
          index: 0,
          raw: {},
          normalized: { email: 'a@x.com', member_tier: 'Gold' },
        },
      ],
    });

    expect(ledger[0].beforePatch.data.member_tier).toBeNull();
    expect(ledger[0].appliedPatch.data.member_tier).toBe('Gold');
  });

  it('stops at the apply time budget and reports the rest as resumable', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    let completeCalls = 0;
    let pausedFlag: boolean | null = null;
    const slowWriter: CsvUpdateWriter = {
      ...memoryWriter(applied),
      async applyUpdate(target) {
        applied.push({ id: target.recordId, patch: target.patch });
        // Burn the budget on the first write.
        const until = Date.now() + 30;
        while (Date.now() < until) {
          /* spin */
        }
        return { ok: true };
      },
      async completeJob(input) {
        completeCalls++;
        pausedFlag = input.paused;
      },
    };

    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      applyBudgetMs: 10,
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'a@x.com', data: {} }),
        rec({ id: 'r2', email: 'b@x.com', data: {} }),
        rec({ id: 'r3', email: 'c@x.com', data: {} }),
      ]),
      writer: slowWriter,
      rows: [
        { index: 0, raw: {}, normalized: { email: 'a@x.com', city: 'A' } },
        { index: 1, raw: {}, normalized: { email: 'b@x.com', city: 'B' } },
        { index: 2, raw: {}, normalized: { email: 'c@x.com', city: 'C' } },
      ],
    });

    expect(result.updated).toBe(1);
    expect(result.remainingRowIndices).toEqual([1, 2]);
    // Progress IS recorded, but flagged paused so the job keeps a
    // non-terminal status until the file is finished.
    expect(completeCalls).toBe(1);
    expect(pausedFlag).toBe(true);
  });

  it('a resume pass writes only the outstanding rows and finalises the job once', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    let completeCalls = 0;
    const writer: CsvUpdateWriter = {
      ...memoryWriter(applied),
      async completeJob() {
        completeCalls++;
      },
    };

    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      jobId: '11111111-1111-1111-1111-111111111111',
      resumeRowIndices: [2],
      carryOver: {
        updated: 1,
        errorCount: 0,
        writeAttemptCount: 1,
        conflictCount: 0,
        auditFailureCount: 0,
      },
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'a@x.com', data: {} }),
        rec({ id: 'r2', email: 'b@x.com', data: {} }),
        rec({ id: 'r3', email: 'c@x.com', data: {} }),
      ]),
      writer,
      rows: [
        { index: 0, raw: {}, normalized: { email: 'a@x.com', city: 'A' } },
        { index: 1, raw: {}, normalized: { email: 'b@x.com', city: 'B' } },
        { index: 2, raw: {}, normalized: { email: 'c@x.com', city: 'C' } },
      ],
    });

    expect(applied).toHaveLength(1);
    expect(applied[0].id).toBe('r3');
    expect(result.remainingRowIndices).toEqual([]);
    expect(completeCalls).toBe(1);
    // Whole-file resolution still ran, so file-wide counts stay honest.
    expect(result.matched).toBe(3);
  });

  it('keeps duplicate-target fail-closed on a resume pass (whole file re-resolved)', async () => {
    const applied: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const result = await runCsvUpdate({
      moduleKey: 'contacts',
      dryRun: false,
      jobId: '11111111-1111-1111-1111-111111111111',
      // Even if a caller asks to write row 1 in isolation, the file-wide
      // duplicate sweep must still remove it.
      resumeRowIndices: [1],
      lookup: memoryLookup([
        rec({ id: 'r1', email: 'shared@x.com', data: { zoho_id: 'z1' } }),
      ]),
      writer: memoryWriter(applied),
      rows: [
        { index: 0, raw: {}, normalized: { zoho_id: 'z1', city: 'A' } },
        { index: 1, raw: {}, normalized: { email: 'shared@x.com', city: 'B' } },
      ],
    });

    expect(result.duplicateTarget).toBe(2);
    expect(applied).toHaveLength(0);
  });

  it('rejects a CSV with an unterminated quoted field instead of guessing', () => {
    const csv = 'Email,Street\na@x.com,"123 Main St\nApt 4';
    expect(() => parseCsv(csv)).toThrow(/Unterminated quoted field/);
  });

  it('keeps a quoted multi-line street on one row', () => {
    const csv = [
      'Email,Street,City',
      'a@x.com,"123 Main St\nApt 4",Denver',
      'b@x.com,456 Oak Ave,Boulder',
    ].join('\n');
    const parsed = parseCsv(csv);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].normalized.mailing_street).toBe('123 Main St\nApt 4');
    expect(parsed.rows[0].normalized.mailing_city).toBe('Denver');
    expect(parsed.rows[1].normalized.email).toBe('b@x.com');
  });
});
