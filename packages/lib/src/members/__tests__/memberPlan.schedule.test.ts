/**
 * staffSchedulePlanChange / staffCancelScheduledPlanChange:
 * scheduling must leave current coverage and billing untouched (pending row +
 * end date only), be rejected for non-future dates / missing active plan /
 * double-scheduling, and cancelling must fully restore the pre-schedule state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../membershipBillingRecalc', async (importOriginal) => {
  const original = await importOriginal<typeof import('../membershipBillingRecalc')>();
  return {
    ...original,
    recalculateMemberBillingFromCoverage: vi.fn(async () => ({
      success: true,
      previousAmount: 0,
      newAmount: 0,
      coveredCount: 0,
      breakdown: [],
    })),
  };
});

import {
  staffSchedulePlanChange,
  staffCancelScheduledPlanChange,
  staffEndPlan,
} from '../memberPlan';
import type { StaffCoverageContext } from '../staffDependentCoverage';

type Op = {
  table: string;
  kind: 'select' | 'insert' | 'update' | 'delete';
  values?: Record<string, unknown>;
  filters: { method: string; column?: string; value?: unknown }[];
};

function makeSupabase(queues: Record<string, { data: unknown; error: unknown }[]>) {
  const remaining: Record<string, { data: unknown; error: unknown }[]> = Object.fromEntries(
    Object.entries(queues).map(([k, v]) => [k, [...v]]),
  );
  const ops: Op[] = [];

  function builder(table: string) {
    const op: Op = { table, kind: 'select', filters: [] };
    const next = () => remaining[table]?.shift() ?? { data: null, error: null };

    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.insert = (values: Record<string, unknown>) => {
      op.kind = 'insert';
      op.values = values;
      return b;
    };
    b.update = (values: Record<string, unknown>) => {
      op.kind = 'update';
      op.values = values;
      return b;
    };
    b.delete = () => {
      op.kind = 'delete';
      return b;
    };
    b.eq = (column: string, value: unknown) => (op.filters.push({ method: 'eq', column, value }), b);
    b.gt = (column: string, value: unknown) => (op.filters.push({ method: 'gt', column, value }), b);
    b.in = (column: string, value: unknown) => (op.filters.push({ method: 'in', column, value }), b);
    b.is = (column: string, value: unknown) => (op.filters.push({ method: 'is', column, value }), b);
    b.order = () => b;
    b.limit = () => b;
    b.maybeSingle = () => (ops.push(op), Promise.resolve(next()));
    b.single = () => (ops.push(op), Promise.resolve(next()));
    b.then = (resolve: (v: unknown) => unknown) => (ops.push(op), resolve(next()));
    return b;
  }

  return { supabase: { from: (table: string) => builder(table) }, ops };
}

function ctx(supabase: unknown): StaffCoverageContext {
  return {
    supabase: supabase as never,
    organizationId: 'org-1',
    profileId: 'staff-1',
    source: 'admin' as never,
  };
}

const FUTURE = '2099-09-01';
const MEMBER = { data: { id: 'member-1' }, error: null };
const PLAN = {
  data: { id: 'plan-premium', name: 'Premium Care', monthly_share: 350, is_active: true },
  error: null,
};
const CURRENT_ACTIVE = { data: { id: 'mem-old', plan_id: 'plan-care', end_date: null }, error: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('staffSchedulePlanChange', () => {
  it('rejects a non-future effective date', async () => {
    const { supabase, ops } = makeSupabase({});
    const result = await staffSchedulePlanChange(ctx(supabase), {
      member_id: 'member-1',
      plan_id: 'plan-premium',
      effective_date: '2020-01-01',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/future/i);
    expect(ops).toHaveLength(0);
  });

  it('rejects when the member has no active plan', async () => {
    const { supabase } = makeSupabase({
      members: [MEMBER],
      plans: [PLAN],
      memberships: [{ data: null, error: null }], // no active membership
    });
    const result = await staffSchedulePlanChange(ctx(supabase), {
      member_id: 'member-1',
      plan_id: 'plan-premium',
      effective_date: FUTURE,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no active plan/i);
  });

  it('rejects when a change is already scheduled', async () => {
    const { supabase } = makeSupabase({
      members: [MEMBER],
      plans: [PLAN],
      memberships: [
        CURRENT_ACTIVE,
        { data: { id: 'mem-pending', effective_date: '2099-10-01' }, error: null },
      ],
    });
    const result = await staffSchedulePlanChange(ctx(supabase), {
      member_id: 'member-1',
      plan_id: 'plan-premium',
      effective_date: FUTURE,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already has a pending plan \(effective 2099-10-01\)/);
  });

  it('rejects a plan without a standard monthly price', async () => {
    const { supabase } = makeSupabase({
      members: [MEMBER],
      plans: [{ data: { ...PLAN.data, monthly_share: null }, error: null }],
    });
    const result = await staffSchedulePlanChange(ctx(supabase), {
      member_id: 'member-1',
      plan_id: 'plan-premium',
      effective_date: FUTURE,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no standard monthly price/);
  });

  it('inserts the pending row with provenance and schedules the current end date', async () => {
    const { supabase, ops } = makeSupabase({
      members: [MEMBER],
      plans: [PLAN],
      memberships: [
        CURRENT_ACTIVE,
        { data: null, error: null }, // no existing pending
        { data: { id: 'mem-new' }, error: null }, // insert result
        { data: null, error: null }, // end-date update
      ],
    });

    const result = await staffSchedulePlanChange(ctx(supabase), {
      member_id: 'member-1',
      plan_id: 'plan-premium',
      effective_date: FUTURE,
      reason: 'Member upgrade',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ membershipId: 'mem-new', currentEndsOn: '2099-08-31' });

    const insert = ops.find((o) => o.kind === 'insert');
    expect(insert?.values).toMatchObject({
      status: 'pending',
      effective_date: FUTURE,
      billing_amount: 350,
    });
    const custom = insert?.values?.custom_fields as Record<string, unknown>;
    expect(custom.subscriber_base_amount).toBe(350);
    expect(custom.scheduled_change).toMatchObject({
      from_membership_id: 'mem-old',
      from_plan_id: 'plan-care',
      scheduled_by: 'staff-1',
      reason: 'Member upgrade',
    });

    const endUpdate = ops.find((o) => o.kind === 'update');
    expect(endUpdate?.values).toMatchObject({ end_date: '2099-08-31' });
    expect(endUpdate?.values?.status).toBeUndefined(); // stays active
    expect(endUpdate?.filters).toContainEqual({ method: 'eq', column: 'id', value: 'mem-old' });
  });

  it('rejects when the current plan already ends before the change starts', async () => {
    const { supabase } = makeSupabase({
      members: [MEMBER],
      plans: [PLAN],
      memberships: [
        { data: { id: 'mem-old', plan_id: 'plan-care', end_date: '2099-06-30' }, error: null },
      ],
    });
    const result = await staffSchedulePlanChange(ctx(supabase), {
      member_id: 'member-1',
      plan_id: 'plan-premium',
      effective_date: FUTURE,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already ends on 2099-06-30/);
  });
});

describe('staffCancelScheduledPlanChange', () => {
  const PENDING = {
    data: {
      id: 'mem-new',
      status: 'pending',
      effective_date: FUTURE,
      custom_fields: {
        scheduled_change: { from_membership_id: 'mem-old', from_end_date: null },
      },
    },
    error: null,
  };

  it('deletes the pending row and restores the original end date', async () => {
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: { id: 'mem-new' }, error: null }, // ownership check
        PENDING,
        { data: null, error: null }, // delete
        { data: null, error: null }, // restore update
      ],
    });

    const result = await staffCancelScheduledPlanChange(ctx(supabase), {
      member_id: 'member-1',
      pending_membership_id: 'mem-new',
    });

    expect(result.success).toBe(true);
    const del = ops.find((o) => o.kind === 'delete');
    expect(del?.filters).toContainEqual({ method: 'eq', column: 'id', value: 'mem-new' });
    expect(del?.filters).toContainEqual({ method: 'eq', column: 'status', value: 'pending' });

    const restore = ops.find((o) => o.kind === 'update');
    expect(restore?.values).toMatchObject({ end_date: null });
    expect(restore?.filters).toContainEqual({ method: 'eq', column: 'id', value: 'mem-old' });

    // Restore must precede delete: a failed delete leaves a state the
    // switch-day supersede pass self-heals; the reverse strands a wrong end date.
    expect(ops.indexOf(restore!)).toBeLessThan(ops.indexOf(del!));
  });

  it('refuses to cancel a membership that is not a scheduled change', async () => {
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: { id: 'mem-x' }, error: null },
        { data: { id: 'mem-x', status: 'active', effective_date: '2026-01-01', custom_fields: {} }, error: null },
      ],
    });

    const result = await staffCancelScheduledPlanChange(ctx(supabase), {
      member_id: 'member-1',
      pending_membership_id: 'mem-x',
    });

    expect(result.success).toBe(false);
    expect(ops.some((o) => o.kind === 'delete')).toBe(false);
  });
});

describe('staffEndPlan', () => {
  it('blocks ending the current plan while a due scheduled change is still pending', async () => {
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: { id: 'mem-old' }, error: null }, // ownership check
        {
          data: {
            id: 'mem-new',
            effective_date: '2020-01-01',
            custom_fields: {
              scheduled_change: { from_membership_id: 'mem-old' },
            },
          },
          error: null,
        },
      ],
    });

    const result = await staffEndPlan(ctx(supabase), {
      member_id: 'member-1',
      membership_id: 'mem-old',
      end_date: '2020-01-01',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/scheduled/i);
    expect(ops.some((op) => op.kind === 'update')).toBe(false);

    const pendingLookup = ops[1];
    expect(pendingLookup?.filters).toContainEqual({
      method: 'eq',
      column: 'status',
      value: 'pending',
    });
    expect(pendingLookup?.filters.some((filter) => filter.method === 'gt')).toBe(false);
  });
});
