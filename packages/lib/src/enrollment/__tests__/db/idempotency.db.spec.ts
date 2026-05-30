/**
 * Layer 2 — enrollment creation idempotency (backlog C1), guards migration
 * 202605300013. Runs ONLY against STAGING (self-skips); creates rows — never prod.
 *
 * Verifies create_enrollment_tx(p_org_id, p_payload) is exactly-once when an
 * idempotency_key is supplied (double-submit returns the SAME enrollment), and that
 * the no-key path keeps its prior create-every-time behavior.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, hasTestDb } from './testClient';

const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

describe.skipIf(!hasTestDb)('enrollment Layer 2 — C1 create_enrollment_tx idempotency (staging)', () => {
  const db = hasTestDb ? getTestClient() : (null as never);
  let orgId = '';
  let memberId = '';

  beforeAll(async () => {
    const slug = `c1-${uniq()}`;
    const { data: org, error: oErr } = await db.from('organizations').insert({ name: `C1 ${slug}`, slug }).select('id').single();
    if (oErr) throw new Error(`org: ${oErr.message}`);
    orgId = org.id as string;
    const { data: m, error: mErr } = await db.from('members')
      .insert({ organization_id: orgId, first_name: 'Primary', last_name: 'Member', email: `m_${uniq()}@ex.test`, member_number: `MBR-${uniq()}` })
      .select('id').single();
    if (mErr) throw new Error(`member: ${mErr.message}`);
    memberId = m.id as string;
  });

  afterAll(async () => { if (orgId) await db.from('organizations').delete().eq('id', orgId); });

  function callRpc(idemKey?: string) {
    const payload: Record<string, unknown> = {
      primary_member_id: memberId,
      effective_date: '2026-07-01',
      base_monthly_cost: 100,
      household_size: 1,
    };
    if (idemKey) payload.idempotency_key = idemKey;
    return db.rpc('create_enrollment_tx', { p_org_id: orgId, p_payload: payload });
  }

  it('C1 — repeated submit with the SAME idempotency_key creates no duplicate', async () => {
    const key = `idem_${uniq()}`;
    const r1 = await callRpc(key);
    expect(r1.error).toBeNull();
    const r2 = await callRpc(key);
    expect(r2.error).toBeNull();

    const id1 = (r1.data as { enrollment_id: string }).enrollment_id;
    const r2data = r2.data as { enrollment_id: string; idempotent_replay?: boolean };
    expect(r2data.enrollment_id).toBe(id1);          // same enrollment returned
    expect(r2data.idempotent_replay).toBe(true);     // flagged as a replay

    const { data: rows, error } = await db.from('enrollments')
      .select('id').eq('organization_id', orgId).eq('idempotency_key', key);
    expect(error).toBeNull();
    expect(rows?.length).toBe(1);                    // exactly one row, not two
  });

  it('C1 — no idempotency_key preserves prior behavior (distinct enrollments per call)', async () => {
    const a = await callRpc();
    const b = await callRpc();
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect((b.data as { enrollment_id: string }).enrollment_id)
      .not.toBe((a.data as { enrollment_id: string }).enrollment_id);
  });
});
