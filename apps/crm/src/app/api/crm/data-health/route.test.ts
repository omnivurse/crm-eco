/**
 * GET /api/crm/data-health — the conduit contract.
 *
 * Same shape as the duplicates route's tests (that route is the pattern this
 * one copies): who is refused, what happens with no credentials, and proof
 * that every query is pinned to the CALLER's org. Plus the two rules this
 * surface adds — a broken rule must not kill the sweep, and a payload must
 * never carry anything but keys, counts and ids.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile } from '@/test/helpers';

const mockGetAuthProfile = vi.fn();
vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
}));

/** Every statement the sweep executed, in order. */
let executed: string[] = [];
/** SQL fragment that should blow up, to exercise the partial-results path. */
let failOn: string | null = null;
let connectionOptions: Record<string, unknown> | null = null;
const endSpy = vi.fn();

vi.mock('postgres', () => ({
  default: (url: string, options: Record<string, unknown>) => {
    connectionOptions = { url, ...options };
    return {
      unsafe: async (text: string) => {
        executed.push(text);
        if (failOn && text.includes(failOn)) {
          throw new Error('relation "crm_probable_duplicates" does not exist');
        }
        if (text.startsWith('select q.id::text')) {
          return [
            { id: '11111111-1111-4111-8111-111111111111', total: '4' },
            { id: '22222222-2222-4222-8222-222222222222', total: '4' },
          ];
        }
        if (text.includes('as value')) return [{ value: '7' }];
        return [{ total: '250' }]; // book size
      },
      end: async () => {
        endSpy();
      },
    };
  },
}));

import { GET } from './route';
import { PIFH_ORG_ID, RULE_CATALOG } from '@/lib/crm/data-health';

const OTHER_ORG = '99999999-9999-4999-8999-999999999999';

/** buildProfile's default org is not a UUID; the sweep needs a real one. */
function admin(overrides: Record<string, unknown> = {}) {
  return buildProfile({ crm_role: 'crm_admin', organization_id: PIFH_ORG_ID, ...overrides });
}

describe('GET /api/crm/data-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executed = [];
    failOn = null;
    connectionOptions = null;
    process.env.SUPABASE_DB_URL = 'postgresql://sweeper@example.invalid:5432/postgres';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(executed).toEqual([]);
  });

  it('returns 403 for an agent', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_agent' }));
    const res = await GET();
    expect(res.status).toBe(403);
    expect(executed).toEqual([]);
  });

  it('returns 403 for a viewer', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_viewer' }));
    const res = await GET();
    expect(res.status).toBe(403);
    expect(executed).toEqual([]);
  });

  it('fails closed (500) with no sweep connection and no recorded sweep for the org', async () => {
    delete process.env.SUPABASE_DB_URL;
    mockGetAuthProfile.mockResolvedValue(
      admin({ organization_id: OTHER_ORG }),
    );
    const res = await GET();
    expect(res.status).toBe(500);
    expect(executed).toEqual([]);
    // Never another tenant's recorded numbers.
    const body = await res.json();
    expect(body.score).toBeUndefined();
  });

  it('serves the recorded sweep, labelled, when no sweep connection is configured', async () => {
    delete process.env.SUPABASE_DB_URL;
    mockGetAuthProfile.mockResolvedValue(
      admin(),
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('recorded');
    expect(typeof body.score).toBe('number');
    expect(body.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.rules).toHaveLength(RULE_CATALOG.length);
    // The catalog's plain-language sentence rides along even on the fallback.
    expect(body.rules.every((rule: { describe: string }) => rule.describe.length > 0)).toBe(true);
    expect(executed).toEqual([]);
  });

  it('runs the live sweep pinned to the CALLER org and never another', async () => {
    mockGetAuthProfile.mockResolvedValue(
      admin({ crm_role: 'crm_manager' }),
    );
    const res = await GET();
    expect(res.status).toBe(200);

    // Book size + one statement per rule (+ the dupes context query).
    expect(executed.length).toBeGreaterThanOrEqual(RULE_CATALOG.length + 1);
    for (const sql of executed) {
      expect(sql).toContain(PIFH_ORG_ID);
      expect(sql).not.toContain(OTHER_ORG);
    }
    expect(endSpy).toHaveBeenCalled();
  });

  it('logs statement count and the slowest statements — the first prod run is watched', async () => {
    // The sweep has only ever been timed at fixture scale. Prod is ~16k rows and
    // dupes.open-pairs windows over the view that historically hit
    // statement_timeout, so the log has to say WHICH statement is near the
    // ceiling, not just that the sweep was slow.
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockGetAuthProfile.mockResolvedValue(admin());
    await GET();
    const line = log.mock.calls.map((c) => String(c[0])).find((t) => t.includes('live sweep'));
    expect(line).toBeTruthy();
    expect(line).toMatch(/statements=\d+/);
    expect(line).toMatch(/slowest_ms=\d+(\/\d+)*/);
    // Every statement the catalog ran is counted, not just the rules.
    expect(line).toContain(`statements=${executed.length}`);
    log.mockRestore();
  });

  it('opens the connection read-only, single, with a statement timeout', async () => {
    mockGetAuthProfile.mockResolvedValue(admin());
    await GET();
    const connection = (connectionOptions?.connection ?? {}) as Record<string, unknown>;
    expect(connectionOptions?.max).toBe(1);
    expect(connection.default_transaction_read_only).toBe(true);
    expect(Number(connection.statement_timeout)).toBeGreaterThan(0);
  });

  it('returns the scored report with a private 60s cache', async () => {
    mockGetAuthProfile.mockResolvedValue(admin());
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, max-age=60');

    const body = await res.json();
    expect(body.source).toBe('live');
    expect(body.bookSize).toBe(250);
    expect(body.formulaVersion).toBeGreaterThanOrEqual(1);
    expect(body.errors).toEqual([]);
    expect(body.rules).toHaveLength(RULE_CATALOG.length);
    // The score is the engine's — the route never re-derives it.
    expect(body.score).toBeGreaterThan(0);
    expect(body.score).toBeLessThan(100);
    // Sample ids survive; counts come from the window total.
    const first = body.rules[0];
    expect(first.count).toBe(4);
    expect(first.sampleIds).toHaveLength(2);
  });

  it('carries ids and counts only — never a name, phone, email or DOB key', async () => {
    mockGetAuthProfile.mockResolvedValue(admin());
    const res = await GET();
    const body = await res.json();
    const allowed = new Set(['key', 'label', 'severity', 'describe', 'count', 'sampleIds', 'context']);
    for (const rule of body.rules) {
      for (const field of Object.keys(rule)) expect(allowed.has(field)).toBe(true);
    }
    // Samples are bare record ids — an address, a phone or a name could not
    // survive this shape even if a rule's SQL selected one by accident.
    for (const rule of body.rules) {
      for (const id of rule.sampleIds) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }
    }
    expect(JSON.stringify(body)).not.toContain('@');
  });

  it('keeps sweeping when one rule throws — 200 with that rule in errors', async () => {
    failOn = 'crm_probable_duplicates';
    mockGetAuthProfile.mockResolvedValue(admin());
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].key).toBe('dupes.open-pairs');
    expect(body.errors[0].message).toContain('does not exist');
    // The page shows a person the rule's NAME, not its key, so the route has
    // to send one — a failed rule has no sweep result to carry it.
    expect(body.errors[0].label).toBe('Possible duplicate pairs awaiting review');
    // Same shape discipline as the rules array: no room for anything else.
    expect(Object.keys(body.errors[0]).sort()).toEqual(['key', 'label', 'message']);
    // Every other rule still reported — a broken check hides nothing else.
    expect(body.rules).toHaveLength(RULE_CATALOG.length - 1);
    expect(body.rules.some((rule: { key: string }) => rule.key === 'dupes.open-pairs')).toBe(false);
  });

  it('returns 500 when the profile has no organization', async () => {
    mockGetAuthProfile.mockResolvedValue(
      admin({ organization_id: null }),
    );
    const res = await GET();
    expect(res.status).toBe(500);
    expect(executed).toEqual([]);
  });
});
