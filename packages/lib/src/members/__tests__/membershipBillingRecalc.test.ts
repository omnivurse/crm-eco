/**
 * Billing recalc must always target the membership covering TODAY, never a
 * scheduled future plan, and must reprice only that membership's own billing
 * schedule. Locks the fix for the pre-existing landmine where a future-dated
 * `pending` row hijacked the recalc and repriced every active schedule.
 */
import { describe, it, expect } from 'vitest';

import {
  pickBillingMembership,
  recalculateMemberBillingFromCoverage,
  type BillingMembershipCandidate,
} from '../membershipBillingRecalc';

const TODAY = '2026-08-09';

function candidate(over: Partial<BillingMembershipCandidate>): BillingMembershipCandidate {
  return {
    id: 'm-x',
    billing_amount: 100,
    enrollment_id: null,
    plan_id: 'plan-x',
    custom_fields: {},
    status: 'active',
    effective_date: '2026-01-01',
    ...over,
  };
}

describe('pickBillingMembership', () => {
  it('prefers the active row over a future-dated pending row', () => {
    const active = candidate({ id: 'cur', status: 'active', effective_date: '2026-01-01' });
    const upcoming = candidate({ id: 'next', status: 'pending', effective_date: '2026-09-01' });
    expect(pickBillingMembership([upcoming, active], TODAY)?.id).toBe('cur');
  });

  it('falls back to a due pending row (awaiting the activation cron)', () => {
    const due = candidate({ id: 'due', status: 'pending', effective_date: '2026-08-01' });
    const future = candidate({ id: 'next', status: 'pending', effective_date: '2026-09-01' });
    expect(pickBillingMembership([future, due], TODAY)?.id).toBe('due');
  });

  it('falls back to the earliest future pending row when nothing covers today', () => {
    const sept = candidate({ id: 'sept', status: 'pending', effective_date: '2026-09-01' });
    const oct = candidate({ id: 'oct', status: 'pending', effective_date: '2026-10-01' });
    expect(pickBillingMembership([oct, sept], TODAY)?.id).toBe('sept');
  });

  it('returns null for an empty list', () => {
    expect(pickBillingMembership([], TODAY)).toBeNull();
  });

  it('breaks ties between multiple active rows by latest effective_date', () => {
    const older = candidate({ id: 'older', status: 'active', effective_date: '2025-01-01' });
    const newer = candidate({ id: 'newer', status: 'active', effective_date: '2026-06-01' });
    expect(pickBillingMembership([older, newer], TODAY)?.id).toBe('newer');
  });
});

type Filter = { column: string; value: unknown };

/**
 * Table-keyed chainable Supabase stub. Each `from(table)` builder records its
 * filters/updates and resolves the queued result for that table (in order).
 */
function makeSupabase(results: Record<string, unknown[]>) {
  const queues: Record<string, unknown[]> = Object.fromEntries(
    Object.entries(results).map(([k, v]) => [k, [...v]]),
  );
  const updates: { table: string; values: Record<string, unknown>; filters: Filter[] }[] = [];

  function builder(table: string) {
    const filters: Filter[] = [];
    let updateValues: Record<string, unknown> | null = null;
    const next = () => queues[table]?.shift() ?? { data: null, error: null };

    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.update = (values: Record<string, unknown>) => {
      updateValues = values;
      return b;
    };
    b.eq = (column: string, value: unknown) => {
      filters.push({ column, value });
      return b;
    };
    b.in = (column: string, value: unknown) => {
      filters.push({ column, value });
      return b;
    };
    b.is = (column: string, value: unknown) => {
      filters.push({ column, value });
      return b;
    };
    b.order = () => b;
    b.limit = () => b;
    b.maybeSingle = () => Promise.resolve(next());
    b.then = (resolve: (v: unknown) => unknown) => {
      if (updateValues) {
        updates.push({ table, values: updateValues, filters });
        return resolve({ data: null, error: null });
      }
      return resolve(next());
    };
    return b;
  }

  return { supabase: { from: (table: string) => builder(table) }, updates };
}

describe('recalculateMemberBillingFromCoverage', () => {
  it('targets the active membership when a future pending row exists and scopes the schedule reprice to its enrollment', async () => {
    const { supabase, updates } = makeSupabase({
      memberships: [
        {
          data: [
            {
              id: 'mem-upcoming',
              billing_amount: 400,
              enrollment_id: null,
              plan_id: 'plan-premium',
              custom_fields: {},
              status: 'pending',
              effective_date: '2099-09-01',
            },
            {
              id: 'mem-current',
              billing_amount: 250,
              enrollment_id: 'enr-current',
              plan_id: 'plan-care',
              custom_fields: {},
              status: 'active',
              effective_date: '2026-01-01',
            },
          ],
          error: null,
        },
      ],
      dependents: [{ data: [], error: null }],
      dependent_coverage_periods: [{ data: [], error: null }],
      enrollments: [
        { data: { id: 'enr-current', base_monthly_cost: 250, selected_plan_id: 'plan-care' }, error: null },
      ],
      plans: [{ data: { monthly_share: 250, name: 'Care+' }, error: null }],
    });

    const result = await recalculateMemberBillingFromCoverage(supabase, 'member-1', 'org-1');

    expect(result.success).toBe(true);
    expect(result.newAmount).toBe(250);

    const membershipUpdate = updates.find((u) => u.table === 'memberships');
    expect(membershipUpdate?.filters).toContainEqual({ column: 'id', value: 'mem-current' });

    const scheduleUpdate = updates.find((u) => u.table === 'billing_schedules');
    expect(scheduleUpdate?.values).toMatchObject({ amount: 250 });
    expect(scheduleUpdate?.filters).toContainEqual({ column: 'enrollment_id', value: 'enr-current' });
  });

  it('keeps the member-wide schedule update only when no enrollment is linked', async () => {
    const { supabase, updates } = makeSupabase({
      memberships: [
        {
          data: [
            {
              id: 'mem-only',
              billing_amount: 180,
              enrollment_id: null,
              plan_id: 'plan-care',
              custom_fields: {},
              status: 'active',
              effective_date: '2026-01-01',
            },
          ],
          error: null,
        },
      ],
      dependents: [{ data: [], error: null }],
      dependent_coverage_periods: [{ data: [], error: null }],
      // Fallback newest-enrollment lookup finds nothing.
      enrollments: [{ data: null, error: null }],
      plans: [{ data: { monthly_share: 180, name: 'Care+' }, error: null }],
    });

    const result = await recalculateMemberBillingFromCoverage(supabase, 'member-1', 'org-1');

    expect(result.success).toBe(true);
    const scheduleUpdate = updates.find((u) => u.table === 'billing_schedules');
    expect(scheduleUpdate).toBeDefined();
    expect(scheduleUpdate?.filters.some((f) => f.column === 'enrollment_id')).toBe(false);
    expect(scheduleUpdate?.filters).toContainEqual({ column: 'member_id', value: 'member-1' });
  });
});
