import { describe, expect, it } from 'vitest';
import {
  buildCancelScheduledChangeData,
  buildMembershipChangeEntry,
  buildScheduledPlanChangeObject,
  currentPlanFieldsFromData,
  executeScheduleMembershipChange,
  linkedMemberMatchesRecord,
  mergeChangedCrmData,
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

function makeReadSupabase(
  queues: Record<string, Array<{ data: unknown; error: unknown }>>,
) {
  const remaining = Object.fromEntries(
    Object.entries(queues).map(([table, results]) => [table, [...results]]),
  );
  return {
    from(table: string) {
      const next = () => remaining[table]?.shift() ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.maybeSingle = () => Promise.resolve(next());
      builder.then = (resolve: (value: unknown) => unknown) => resolve(next());
      return builder;
    },
  };
}

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

describe('mergeChangedCrmData', () => {
  it('preserves concurrent unrelated edits while applying schedule keys', () => {
    const original = {
      phone: 'old',
      product: 'Care Plus',
      membership_changes: [],
    };
    const desired = {
      ...original,
      membership_changes: [{ id: 'change-1', change_status: 'scheduled' }],
      scheduled_plan_change: {
        change_id: 'change-1',
        effective_date: '2099-10-01',
      },
    };
    const latest = {
      ...original,
      phone: 'new',
      notes: 'saved concurrently',
    };

    expect(mergeChangedCrmData(original, desired, latest)).toEqual({
      phone: 'new',
      product: 'Care Plus',
      notes: 'saved concurrently',
      membership_changes: [{ id: 'change-1', change_status: 'scheduled' }],
      scheduled_plan_change: {
        change_id: 'change-1',
        effective_date: '2099-10-01',
      },
    });
  });

  it('removes a cancelled scheduled key without reverting concurrent fields', () => {
    const original = {
      email: 'old@example.com',
      scheduled_plan_change: { change_id: 'change-1' },
    };
    const desired = { email: 'old@example.com' };
    const latest = {
      ...original,
      email: 'new@example.com',
    };
    expect(mergeChangedCrmData(original, desired, latest)).toEqual({
      email: 'new@example.com',
    });
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

describe('linkedMemberMatchesRecord', () => {
  const member = {
    id: 'member-1',
    member_number: 'PIF-1001',
    email: 'alex@example.com',
    phone: '(555) 111-2222',
    first_name: 'Alex',
    last_name: 'Morgan',
  };

  it('requires corroboration beyond the mutable linked_member_id', () => {
    expect(
      linkedMemberMatchesRecord(member, {
        data: {
          linked_member_id: 'member-1',
          member_number: 'PIF-9999',
          first_name: 'Different',
          last_name: 'Person',
        },
      }),
    ).toBe(false);
  });

  it('accepts matching member numbers or matching name plus contact identity', () => {
    expect(
      linkedMemberMatchesRecord(member, {
        data: { linked_member_id: 'member-1', member_number: 'PIF-1001' },
      }),
    ).toBe(true);
    expect(
      linkedMemberMatchesRecord(
        { ...member, member_number: null },
        {
          email: 'alex@example.com',
          data: {
            linked_member_id: 'member-1',
            first_name: 'Alex',
            last_name: 'Morgan',
          },
        },
      ),
    ).toBe(true);
  });
});

describe('executeScheduleMembershipChange linked-record guards', () => {
  const linkedRecord = {
    id: 'crm-1',
    email: 'alex@example.com',
    phone: null,
    system: null,
    data: {
      linked_member_id: 'member-1',
      member_number: 'PIF-1001',
      first_name: 'Alex',
      last_name: 'Morgan',
      product: 'Care Plus',
    },
  };

  it('fails closed when a linked member has no active core membership', async () => {
    const staffSupabase = makeReadSupabase({
      members: [
        {
          data: {
            id: 'member-1',
            member_number: 'PIF-1001',
            email: 'alex@example.com',
            phone: null,
            first_name: 'Alex',
            last_name: 'Morgan',
          },
          error: null,
        },
      ],
      memberships: [{ data: [], error: null }],
    });

    const result = await executeScheduleMembershipChange({
      userSupabase: {} as never,
      staffCtx: {
        supabase: staffSupabase as never,
        organizationId: 'org-1',
        profileId: 'staff-1',
        source: 'crm',
      },
      organizationId: 'org-1',
      profileId: 'staff-1',
      record: linkedRecord,
      input: {
        type: 'upgrade',
        effective_date: '2099-10-01',
        plan_id: 'plan-new',
      },
      today: '2099-09-01',
    });

    expect(result).toEqual({
      ok: false,
      error: 'This member has no active core membership to change.',
    });
  });

  it('rejects members-module records whose JSON is replaced by member sync', async () => {
    const result = await executeScheduleMembershipChange({
      userSupabase: {} as never,
      staffCtx: {
        supabase: {} as never,
        organizationId: 'org-1',
        profileId: 'staff-1',
        source: 'crm',
      },
      organizationId: 'org-1',
      profileId: 'staff-1',
      record: {
        ...linkedRecord,
        system: { source_table: 'members', source_id: 'member-1', synced: true },
      },
      input: {
        type: 'upgrade',
        effective_date: '2099-10-01',
        plan_id: 'plan-new',
      },
      today: '2099-09-01',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Member Command Center/);
  });
});
