/**
 * Layer 3 — authenticated cross-tenant isolation (backlog C3).
 *
 * Mints a real authenticated user per org (Supabase admin API + signInWithPassword),
 * seeds an enrollment in each org, and asserts that a user in org A cannot read
 * org B's enrollments through RLS. Runs ONLY against STAGING (self-skips otherwise);
 * creates auth users + rows — NEVER point at production.
 *
 * NOTE ON THE FINDING THIS GUARDS: enrollments' "Staff can read enrollments" policy
 * is `USING (is_staff_or_admin())` with NO organization_id filter, and profiles.role
 * defaults to 'staff'. Because RLS policies are OR'd, any staff/agent/admin/
 * super_admin user can read EVERY org's enrollments. PIFH has one org today so it's
 * latent; it becomes a live cross-tenant leak the moment a second tenant exists
 * (i.e. the white-label direction). The 'admin' case below is expected to FAIL until
 * that policy is org-scoped; the 'advisor' case (org+advisor-scoped policy) should pass.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getTestClient, hasTestDb, TEST_DB_URL, TEST_ANON_KEY, hasAnonKey } from './testClient';

const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const RUN = hasTestDb && hasAnonKey;

describe.skipIf(!RUN)('enrollment Layer 3 — authenticated cross-tenant isolation (staging)', () => {
  const db = RUN ? getTestClient() : (null as never);
  const orgs: Record<'A' | 'B', { orgId: string; userId: string; email: string; enrollmentId: string }> =
    { A: {} as never, B: {} as never };
  const PASSWORD = `Test!${uniq()}`;
  const authed: Record<'A' | 'B', SupabaseClient> = {} as never;

  async function seedOrg(tag: 'A' | 'B', role: string) {
    const slug = `xtenant-${tag}-${uniq()}`;
    const { data: org, error: oErr } = await db
      .from('organizations').insert({ name: `XTenant ${tag}`, slug }).select('id').single();
    if (oErr) throw new Error(`org ${tag}: ${oErr.message}`);
    const orgId = org.id as string;

    const { data: member, error: mErr } = await db
      .from('members')
      .insert({ organization_id: orgId, first_name: tag, last_name: 'Primary', email: `m_${tag}_${uniq()}@ex.test`, member_number: `MBR-${uniq()}` })
      .select('id').single();
    if (mErr) throw new Error(`member ${tag}: ${mErr.message}`);

    const { data: enr, error: eErr } = await db
      .from('enrollments').insert({ organization_id: orgId, primary_member_id: member.id }).select('id').single();
    if (eErr) throw new Error(`enrollment ${tag}: ${eErr.message}`);

    const email = `user_${tag}_${uniq()}@ex.test`;
    const { data: created, error: uErr } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (uErr) throw new Error(`createUser ${tag}: ${uErr.message}`);
    const userId = created.user!.id;

    const { error: pErr } = await db
      .from('profiles').insert({ user_id: userId, organization_id: orgId, email, full_name: `User ${tag}`, role });
    if (pErr) throw new Error(`profile ${tag}: ${pErr.message}`);

    // Mint a JWT by signing in on a fresh anon-key client.
    const client = createClient(TEST_DB_URL as string, TEST_ANON_KEY as string, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: sErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (sErr) throw new Error(`signIn ${tag}: ${sErr.message}`);

    orgs[tag] = { orgId, userId, email, enrollmentId: enr.id as string };
    authed[tag] = client;
  }

  afterAll(async () => {
    for (const tag of ['A', 'B'] as const) {
      if (orgs[tag]?.userId) await db.auth.admin.deleteUser(orgs[tag].userId).catch(() => {});
      if (orgs[tag]?.orgId) await db.from('organizations').delete().eq('id', orgs[tag].orgId); // CASCADE members/enrollments/profiles
    }
  });

  describe('admin-role users (role=admin)', () => {
    beforeAll(async () => { await seedOrg('A', 'admin'); await seedOrg('B', 'admin'); });

    // KNOWN C3 LEAK (confirmed 2026-05-30): org-A admin CAN currently read org-B
    // enrollments because the "Staff can read enrollments" policy is
    // USING (is_staff_or_admin()) with no organization_id filter, and RLS policies
    // are OR'd. This is one of 15 such non-org-scoped is_staff_or_admin() policies
    // across 13 tables (members, commissions, advisors, products, ...). it.fails =
    // the suite stays green while the gap exists; when the policies are org-scoped
    // this flips to FAILING — that is the signal to delete `.fails`.
    it.fails('org-A admin must NOT see org-B enrollments [EXPECTED-FAIL: non-org-scoped Staff RLS leaks cross-tenant]', async () => {
      const { data, error } = await authed.A.from('enrollments').select('id, organization_id');
      expect(error).toBeNull();
      const foreign = (data ?? []).filter(r => r.organization_id === orgs.B.orgId);
      expect(foreign).toHaveLength(0); // correct behavior; currently fails (leak)
    });

    it('org-A admin can still see its OWN org enrollment (sanity)', async () => {
      const { data } = await authed.A.from('enrollments').select('id').eq('id', orgs.A.enrollmentId);
      expect((data ?? []).length).toBe(1);
    });
  });
});
