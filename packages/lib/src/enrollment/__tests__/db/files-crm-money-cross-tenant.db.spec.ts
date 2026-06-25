/**
 * Phase 0 — Tenancy hardening: cross-tenant isolation for files + crm_records + money tables.
 *
 * Companion to cross-tenant.db.spec.ts (which guards enrollments). Mints a real authenticated
 * user per org (Supabase admin API + signInWithPassword), seeds a files row (visibility='org' —
 * the leak vector), a crm_records row, and a payment_transactions row in each org, then asserts a
 * user in org A cannot READ org B's rows and cannot WRITE into org B (WITH CHECK).
 *
 * Runs ONLY against STAGING (self-skips otherwise); creates auth users + rows — NEVER production.
 *
 * EXPECTED RESULT WINDOW:
 *   - BEFORE applying drafts/202606230002 §5.2, the `files — must NOT see org-B` assertion FAILS
 *     (the visibility='org' policy at baseline.sql:74852 has no org predicate).
 *   - AFTER §5.2, it PASSES.
 *   - crm_records + payment_transactions are the CONTROL group — already org-scoped, so their
 *     cross-org tests pass today; the own-org sanity tests prove the controls are actually live.
 *
 * Seed correctness (adversarial-review blockers folded in):
 *   - crm_records.module_id is NOT NULL (FK -> crm_modules) — seed a real per-org module.
 *   - payment_transactions.transaction_type + status are NOT NULL with CHECK constraints.
 *   - crm_records SELECT is gated by is_crm_member(organization_id) (baseline L73155), NOT
 *     get_user_organization_id() — seed an ACTIVE organization_members row or the isolation test
 *     passes vacuously (a staff profile with no membership sees zero records, even its own).
 *
 * If the first staging run throws on a seed insert for a NOT-NULL column not listed here, add the
 * column with a valid value — the schema is the source of truth, this seed mirrors the design.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getTestClient, hasTestDb, TEST_DB_URL, TEST_ANON_KEY, hasAnonKey } from './testClient';

const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const RUN = hasTestDb && hasAnonKey;

type Seed = {
  orgId: string; userId: string; email: string;
  fileId: string; recordId: string; paymentId: string;
  memberId: string; moduleId: string;
};

describe.skipIf(!RUN)('Phase 0 — cross-tenant isolation: files / crm_records / payments (staging)', () => {
  const db = RUN ? getTestClient() : (null as never);
  const orgs: Record<'A' | 'B', Seed> = { A: {} as never, B: {} as never };
  const PASSWORD = `Test!${uniq()}`;
  const authed: Record<'A' | 'B', SupabaseClient> = {} as never;

  async function seedOrg(tag: 'A' | 'B'): Promise<void> {
    const slug = `xt-files-${tag}-${uniq()}`;
    const { data: org, error: oErr } = await db
      .from('organizations').insert({ name: `XT ${tag}`, slug }).select('id').single();
    if (oErr) throw new Error(`org ${tag}: ${oErr.message}`);
    const orgId = org.id as string;

    const email = `u_${tag}_${uniq()}@ex.test`;
    const { data: created, error: uErr } =
      await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (uErr) throw new Error(`createUser ${tag}: ${uErr.message}`);
    const userId = created.user!.id;

    const { error: pErr } = await db.from('profiles')
      .insert({ user_id: userId, organization_id: orgId, email, full_name: `User ${tag}`, role: 'staff' });
    if (pErr) throw new Error(`profile ${tag}: ${pErr.message}`);

    // is_crm_member(organization_id) honors an ACTIVE organization_members row (baseline L73155);
    // without it the isolation assertion would pass vacuously.
    const { error: omErr } = await db.from('organization_members')
      .insert({ organization_id: orgId, user_id: userId, role: 'staff', is_active: true });
    if (omErr) throw new Error(`org_member ${tag}: ${omErr.message}`);

    // files row owned by THIS org's user; visibility='org' is the leak vector being closed.
    const { data: file, error: fErr } = await db.from('files')
      .insert({ owner_id: userId, organization_id: orgId, filename: `f_${tag}.txt`,
                storage_path: `xt/${tag}/${uniq()}`, visibility: 'org' })
      .select('id').single();
    if (fErr) throw new Error(`file ${tag}: ${fErr.message}`);

    // crm_records.module_id is NOT NULL (FK -> crm_modules). crm_modules.org_id is NOT NULL;
    // organization_id is nullable (the sync trigger fills it).
    const { data: mod, error: modErr } = await db.from('crm_modules')
      .insert({ org_id: orgId, key: `xt_mod_${uniq()}`, name: `XT Module ${tag}` })
      .select('id').single();
    if (modErr) throw new Error(`crm_module ${tag}: ${modErr.message}`);

    const { data: rec, error: rErr } = await db.from('crm_records')
      .insert({ org_id: orgId, module_id: mod.id, data: {} })
      .select('id').single();
    if (rErr) throw new Error(`crm_record ${tag}: ${rErr.message}`);

    const { data: member, error: memErr } = await db.from('members')
      .insert({ organization_id: orgId, first_name: tag, last_name: 'P',
                email: `m_${tag}_${uniq()}@ex.test`, member_number: `MBR-${uniq()}` })
      .select('id').single();
    if (memErr) throw new Error(`member ${tag}: ${memErr.message}`);

    // transaction_type + status are NOT NULL with CHECK constraints
    // (transaction_type in {auth_capture,auth_only,capture,void,refund,credit};
    //  status in {approved,declined,error,held_for_review}).
    const { data: pay, error: payErr } = await db.from('payment_transactions')
      .insert({ organization_id: orgId, member_id: member.id, amount: 1,
                transaction_id: `tx_${uniq()}`, transaction_type: 'auth_capture', status: 'approved' })
      .select('id').single();
    if (payErr) throw new Error(`payment ${tag}: ${payErr.message}`);

    const client = createClient(TEST_DB_URL as string, TEST_ANON_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: sErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (sErr) throw new Error(`signIn ${tag}: ${sErr.message}`);

    orgs[tag] = { orgId, userId, email, fileId: file.id, recordId: rec.id,
                  paymentId: pay.id, memberId: member.id, moduleId: mod.id };
    authed[tag] = client;
  }

  beforeAll(async () => { await seedOrg('A'); await seedOrg('B'); });

  afterAll(async () => {
    for (const tag of ['A', 'B'] as const) {
      if (orgs[tag]?.userId) await db.auth.admin.deleteUser(orgs[tag].userId).catch(() => {});
      // child rows may not CASCADE from org — delete children first, then the org.
      if (orgs[tag]?.fileId)    await db.from('files').delete().eq('id', orgs[tag].fileId);
      if (orgs[tag]?.recordId)  await db.from('crm_records').delete().eq('id', orgs[tag].recordId);
      if (orgs[tag]?.moduleId)  await db.from('crm_modules').delete().eq('id', orgs[tag].moduleId);
      if (orgs[tag]?.paymentId) await db.from('payment_transactions').delete().eq('id', orgs[tag].paymentId);
      if (orgs[tag]?.memberId)  await db.from('members').delete().eq('id', orgs[tag].memberId);
      if (orgs[tag]?.userId)    await db.from('organization_members').delete().eq('user_id', orgs[tag].userId);
      if (orgs[tag]?.orgId)     await db.from('organizations').delete().eq('id', orgs[tag].orgId);
    }
  });

  // ---- FILES read isolation (THE fix under test) ----
  it('files — org-A user must NOT see org-B files [FAILS until 202606230002 §5.2 is applied]', async () => {
    const { data, error } = await authed.A.from('files').select('id, organization_id');
    expect(error).toBeNull();
    const foreign = (data ?? []).filter(r => r.organization_id === orgs.B.orgId);
    expect(foreign).toHaveLength(0);
  });

  it('files — org-A user CAN see its own org file (sanity / control is live)', async () => {
    const { data, error } = await authed.A.from('files').select('id').eq('id', orgs.A.fileId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(1);
  });

  // ---- crm_records read isolation (control group — already org-scoped via is_crm_member) ----
  it('crm_records — org-A user CAN see its own org record (sanity / proves the control works)', async () => {
    const { data, error } = await authed.A.from('crm_records').select('id').eq('id', orgs.A.recordId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(1);
  });

  it('crm_records — org-A user must NOT see org-B records', async () => {
    const { data, error } = await authed.A.from('crm_records').select('id, org_id, organization_id');
    expect(error).toBeNull();
    const foreign = (data ?? []).filter(r => r.org_id === orgs.B.orgId || r.organization_id === orgs.B.orgId);
    expect(foreign).toHaveLength(0);
  });

  // ---- payment_transactions read + write isolation (control group) ----
  it('payment_transactions — org-A user must NOT see org-B payments', async () => {
    const { data, error } = await authed.A.from('payment_transactions').select('id, organization_id');
    expect(error).toBeNull();
    const foreign = (data ?? []).filter(r => r.organization_id === orgs.B.orgId);
    expect(foreign).toHaveLength(0);
  });

  it('payment_transactions — org-A user CANNOT insert a payment into org-B (WITH CHECK rejection)', async () => {
    const { error } = await authed.A.from('payment_transactions').insert({
      organization_id: orgs.B.orgId, member_id: orgs.B.memberId, amount: 1,
      transaction_id: `tx_${uniq()}`, transaction_type: 'auth_capture', status: 'approved',
    }).select('id');
    expect(error).not.toBeNull();
  });
});
