/**
 * Layer 2/3 enrollment DB/RLS specs — member-dedup characterization (C2) and the
 * anonymous-surface lockdown / tenant-isolation guard (C3).
 *
 * Runs ONLY against a STAGING Supabase (self-skips otherwise). These specs CREATE
 * and MUTATE rows — NEVER point SUPABASE_TEST_URL at production.
 *
 * Resolved decisions baked in (2026-05-30):
 *  - Anonymous public self-enroll is a first-class surface → the `anon` role must
 *    NOT be able to read or write enrollment data directly; self-enroll must flow
 *    through the hardened SECURITY DEFINER path only (backlog C3).
 *  - PIFH is the pilot org; tests use a disposable, synthetic (non-PHI) org.
 *
 * Fixtures: a throwaway organization (organizations.organization_id is the cascade
 * root) → members FK organization_id ON DELETE CASCADE, so afterAll cleanup is a
 * single org delete.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, getAnonClient, hasTestDb, hasAnonKey } from './testClient';

const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

describe.skipIf(!hasTestDb)('enrollment Layer 2/3 — RLS & dedup (staging)', () => {
  const db = hasTestDb ? getTestClient() : (null as never);
  let orgId = '';

  beforeAll(async () => {
    const slug = `l2-test-${uniq()}`;
    const { data, error } = await db
      .from('organizations')
      .insert({ name: `L2 Test ${slug}`, slug })
      .select('id')
      .single();
    if (error) throw new Error(`fixture org insert failed: ${error.message}`);
    orgId = data.id as string;
  });

  afterAll(async () => {
    // ON DELETE CASCADE on members.organization_id cleans up all seeded rows.
    if (orgId) await db.from('organizations').delete().eq('id', orgId);
  });

  function insertMember(email: string) {
    return db
      .from('members')
      .insert({
        organization_id: orgId,
        first_name: 'Test',
        last_name: 'Member',
        email,
        member_number: `MBR-${uniq()}`,
      })
      .select('id')
      .single();
  }

  // ---------------------------------------------------------------------------
  // C2 — member dedup. CHARACTERIZES the current gap: there is no unique index on
  // (email, organization_id), so a double-submit creates duplicate members. When
  // the C2 fix lands, the second insert should be rejected/merged — flip this test
  // and promote the it.todo below.
  // ---------------------------------------------------------------------------
  it('C2 — currently ALLOWS duplicate (email, organization_id) members [BUG: should dedup]', async () => {
    const email = `dup_${uniq()}@example.test`;
    const a = await insertMember(email);
    const b = await insertMember(email);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull(); // today: second insert succeeds (the gap)

    const { data: rows, error } = await db
      .from('members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', email);
    expect(error).toBeNull();
    expect(rows?.length).toBe(2); // C2 fix target: becomes 1 (then invert this assertion)
  });

  it.todo(
    'C2 — after fix: a unique partial index on (lower(email), organization_id) rejects or merges the duplicate member'
  );

  // ---------------------------------------------------------------------------
  // C3 — anonymous surface lockdown. With RLS enabled and NO anon policy on
  // members/enrollments, the `anon` role must neither read existing rows nor write.
  // ---------------------------------------------------------------------------
  describe.skipIf(!hasAnonKey)('C3 — anon role is denied direct enrollment-data access', () => {
    const anon = hasAnonKey ? getAnonClient() : (null as never);

    it('anon CANNOT read members even when rows exist (RLS denies; no anon policy)', async () => {
      await insertMember(`rls_read_${uniq()}@example.test`); // seed via service role
      const { data, error } = await anon.from('members').select('id').eq('organization_id', orgId);
      // RLS with no anon policy → empty set (or error); must never leak rows.
      const leaked = !error && (data?.length ?? 0) > 0;
      expect(leaked).toBe(false);
    });

    it('anon CANNOT insert a member (RLS WITH CHECK denies the write surface)', async () => {
      // Fully-valid row, so the ONLY thing that can reject it is RLS (not NOT NULL).
      const { error } = await anon
        .from('members')
        .insert({
          organization_id: orgId,
          first_name: 'Anon',
          last_name: 'Intruder',
          email: `anon_write_${uniq()}@example.test`,
          member_number: `MBR-${uniq()}`,
        })
        .select('id')
        .single();
      expect(error).not.toBeNull(); // RLS denial (PostgREST surfaces 42501)
    });

    it('anon CANNOT read enrollments (no anon SELECT policy)', async () => {
      const { data, error } = await anon.from('enrollments').select('id').limit(5);
      const leaked = !error && (data?.length ?? 0) > 0;
      expect(leaked).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Heavier cases — scaffolded; need plan/advisor fixtures or minted per-org JWTs.
  // ---------------------------------------------------------------------------
  it.todo(
    'C1 — create_enrollment_tx: repeated submit with the same idempotency key creates no duplicate enrollment (needs an idempotency_key column + member/plan/advisor fixtures)'
  );
  it.todo(
    'C3-auth — an authenticated user in org A cannot SELECT org B enrollments (needs minted authenticated JWTs scoped per org)'
  );
  it.todo(
    'triggers — re-running enrollment activation does not double-insert billing_schedules / commissions (idempotent triggers)'
  );
});
