import { describe, expect, it } from 'vitest';
import {
  buildCancelScheduledChangeData,
  buildMembershipChangeEntry,
  buildScheduledPlanChangeObject,
  currentPlanFieldsFromData,
  normalizePlanLookup,
  pickActiveCoreMembership,
  resolvePlanFromCatalog,
  upsertMembershipChange,
  type BillingPlanOption,
} from './schedule-membership-change';

const PLANS: BillingPlanOption[] = [
  { id: 'p-cp', name: 'PIFH Care Plus', code: 'PIFH-CP-2025', monthly_share: 360, iua_amount: 2500 },
  { id: 'p-hsa', name: 'PIFH Secure HSA', code: 'PIFH-SHSA-2025', monthly_share: 390, iua_amount: 2500 },
];

describe('normalizePlanLookup', () => {
  it('folds Care+ / Care Plus / year / plan codes', () => {
    expect(normalizePlanLookup('Care Plus 2024 (42644)')).toBe('careplus');
    expect(normalizePlanLookup('Care+')).toBe('careplus');
    expect(normalizePlanLookup('PIFH Care Plus')).toBe('pifhcareplus');
    expect(normalizePlanLookup('Secure HSA')).toBe('securehsa');
    expect(normalizePlanLookup('PIFH Secure HSA')).toBe('pifhsecurehsa');
  });
});

describe('resolvePlanFromCatalog', () => {
  it('resolves by explicit plan_id', () => {
    const hit = resolvePlanFromCatalog(PLANS, { plan_id: 'p-hsa' });
    expect(hit).toEqual({ ok: true, plan: PLANS[1] });
  });

  it('matches Secure HSA to PIFH Secure HSA', () => {
    const hit = resolvePlanFromCatalog(PLANS, { to_plan: 'Secure HSA' });
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.plan.id).toBe('p-hsa');
  });

  it('matches Care+ to PIFH Care Plus', () => {
    const hit = resolvePlanFromCatalog(PLANS, { to_plan: 'Care+' });
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.plan.id).toBe('p-cp');
  });

  it('fails closed on unknown names', () => {
    const hit = resolvePlanFromCatalog(PLANS, { to_plan: 'Gold PPO' });
    expect(hit.ok).toBe(false);
  });
});

describe('upsertMembershipChange', () => {
  it('keeps only one scheduled marker', () => {
    const first = buildMembershipChangeEntry(
      { type: 'upgrade', effective_date: '2026-10-01', to_plan: 'A', change_id: 'c1' },
      { scheduled: true, nowIso: '2026-09-01T00:00:00Z' },
    );
    const second = buildMembershipChangeEntry(
      { type: 'upgrade', effective_date: '2026-11-01', to_plan: 'B', change_id: 'c2' },
      { scheduled: true, nowIso: '2026-09-01T00:00:00Z' },
    );
    const next = upsertMembershipChange([first], second);
    expect(next.find((c) => c.id === 'c1')?.change_status).toBeUndefined();
    expect(next.find((c) => c.id === 'c2')?.change_status).toBe('scheduled');
  });
});

describe('buildCancelScheduledChangeData', () => {
  it('clears the scheduled key and unmarks the matching history entry', () => {
    const change = buildMembershipChangeEntry(
      { type: 'upgrade', effective_date: '2026-10-01', to_plan: 'Secure HSA', change_id: 'c1' },
      { scheduled: true, nowIso: '2026-09-01T00:00:00Z' },
    );
    const cancelled = buildCancelScheduledChangeData({
      product: 'Care+',
      membership_changes: [change],
      scheduled_plan_change: {
        ...buildScheduledPlanChangeObject(change, { mms_membership_id: 'mem-pending' }),
      },
    });
    expect(cancelled.mmsMembershipId).toBe('mem-pending');
    expect(cancelled.changeId).toBe('c1');
    expect(cancelled.data.scheduled_plan_change).toBeUndefined();
    expect((cancelled.data.membership_changes as { change_status?: string }[])[0].change_status).toBeUndefined();
    expect(cancelled.data.product).toBe('Care+');
  });
});

describe('pickActiveCoreMembership', () => {
  it('prefers the core layer over an add-on', () => {
    const picked = pickActiveCoreMembership([
      { id: 'addon', status: 'active', layer: 'addon' },
      { id: 'core', status: 'active', layer: 'core' },
    ]);
    expect(picked?.id).toBe('core');
  });
});

describe('currentPlanFieldsFromData', () => {
  it('reads product / IUA / monthly from the contact blob', () => {
    expect(
      currentPlanFieldsFromData({
        product: 'Care Plus 2024 (42644)',
        iua_amount: 2500,
        monthly_contribution: 360,
      }),
    ).toEqual({
      product: 'Care Plus 2024 (42644)',
      iua: '2500',
      monthly: '360',
    });
  });
});
