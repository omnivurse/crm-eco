/**
 * Layer 2 — billing-trigger idempotency (backlog: "re-running activation must not
 * double-insert billing_schedules"). Runs ONLY against STAGING (self-skips); creates
 * rows — never prod.
 *
 * generate_billing_schedule_on_enrollment_active() fires on transition to 'approved'
 * and inserts a billing_schedule with a deterministic idempotency_key + ON CONFLICT
 * DO NOTHING. This proves a re-transition to 'approved' does not create a duplicate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, hasTestDb } from './testClient';

const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

describe.skipIf(!hasTestDb)('enrollment Layer 2 — billing-trigger idempotency (staging)', () => {
  const db = hasTestDb ? getTestClient() : (null as never);
  let orgId = '';
  let enrollmentId = '';

  beforeAll(async () => {
    const slug = `trig-${uniq()}`;
    const { data: org, error: oErr } = await db.from('organizations').insert({ name: `Trig ${slug}`, slug }).select('id').single();
    if (oErr) throw new Error(`org: ${oErr.message}`);
    orgId = org.id as string;
    const { data: m, error: mErr } = await db.from('members')
      .insert({ organization_id: orgId, first_name: 'Bill', last_name: 'Member', email: `m_${uniq()}@ex.test`, member_number: `MBR-${uniq()}` })
      .select('id').single();
    if (mErr) throw new Error(`member: ${mErr.message}`);
    // Create via the RPC (exercises the INSERT trigger chain cleanly).
    const { data: rpc, error: rErr } = await db.rpc('create_enrollment_tx', {
      p_org_id: orgId,
      p_payload: { primary_member_id: m.id, effective_date: '2026-08-01', base_monthly_cost: 100, permanent_bill_day: 20 },
    });
    if (rErr) throw new Error(`create_enrollment_tx: ${rErr.message}`);
    enrollmentId = (rpc as { enrollment_id: string }).enrollment_id;
  });

  afterAll(async () => { if (orgId) await db.from('organizations').delete().eq('id', orgId); });

  async function setStatus(status: string) {
    const { error } = await db.from('enrollments').update({ status }).eq('id', enrollmentId);
    if (error) throw new Error(`set status ${status}: ${error.message}`);
  }
  async function billingCount() {
    const { data, error } = await db.from('billing_schedules').select('id').eq('enrollment_id', enrollmentId);
    if (error) throw new Error(`count: ${error.message}`);
    return data?.length ?? 0;
  }

  it('re-transitioning to approved does not create duplicate billing_schedules', async () => {
    await setStatus('approved');
    expect(await billingCount()).toBe(1); // first activation generates exactly one schedule

    // Toggle away and back so the trigger condition (OLD<>approved AND NEW=approved) fires again.
    await setStatus('submitted');
    await setStatus('approved');
    expect(await billingCount()).toBe(1); // ON CONFLICT (idempotency_key) DO NOTHING → still one
  });
});
