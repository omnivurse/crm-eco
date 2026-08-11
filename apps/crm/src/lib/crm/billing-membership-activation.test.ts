/**
 * Supersede pass: a scheduled plan change must terminate the outgoing
 * membership (last covered day = new effective_date − 1), cancel the outgoing
 * enrollment's billing schedule only when the incoming membership brings its
 * own, and refresh the member's denormalized plan columns — all before the
 * pending row activates. A failed supersede must leave the pending row
 * untouched (retried next run), never activated into a double-billing state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@crm-eco/lib', () => ({
  recalculateMemberBillingFromCoverage: vi.fn(async () => ({ success: true })),
}));

import {
  applyDueMembershipActivation,
  listSupersedeCandidates,
  previousDay,
} from './billing-membership-activation';
import { recalculateMemberBillingFromCoverage } from '@crm-eco/lib';

type Op = {
  table: string;
  kind: 'select' | 'update';
  values?: Record<string, unknown>;
  filters: { method: string; column?: string; value?: unknown }[];
};

/**
 * Table-keyed chainable Supabase stub. Every awaited query (select or update)
 * consumes the next queued result for its table; all operations are recorded
 * with their filters for assertions.
 */
function makeSupabase(queues: Record<string, { data: unknown; error: unknown }[]>) {
  const remaining: Record<string, { data: unknown; error: unknown }[]> = Object.fromEntries(
    Object.entries(queues).map(([k, v]) => [k, [...v]]),
  );
  const ops: Op[] = [];

  function builder(table: string) {
    const op: Op = { table, kind: 'select', filters: [] };
    const next = () => remaining[table]?.shift() ?? { data: null, error: null };
    const record = (method: string, column?: string, value?: unknown) => {
      op.filters.push({ method, column, value });
    };

    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.update = (values: Record<string, unknown>) => {
      op.kind = 'update';
      op.values = values;
      return b;
    };
    b.eq = (column: string, value: unknown) => (record('eq', column, value), b);
    b.in = (column: string, value: unknown) => (record('in', column, value), b);
    b.lte = (column: string, value: unknown) => (record('lte', column, value), b);
    b.limit = () => b;
    b.maybeSingle = () => {
      ops.push(op);
      return Promise.resolve(next());
    };
    b.then = (resolve: (v: unknown) => unknown) => {
      ops.push(op);
      return resolve(next());
    };
    return b;
  }

  return { supabase: { from: (table: string) => builder(table) } as never, ops };
}

const DUE_ROW = {
  id: 'mem-new',
  member_id: 'member-1',
  organization_id: 'org-1',
  effective_date: '2026-09-01',
  plan_id: 'plan-premium',
  enrollment_id: 'enr-new',
  billing_amount: 350,
  custom_fields: null,
};

const OUTGOING_ACTIVE = {
  id: 'mem-old',
  member_id: 'member-1',
  enrollment_id: 'enr-old',
  end_date: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('previousDay', () => {
  it('handles month, year, and leap boundaries in UTC', () => {
    expect(previousDay('2026-09-01')).toBe('2026-08-31');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(previousDay('2024-03-01')).toBe('2024-02-29');
  });
});

describe('listSupersedeCandidates', () => {
  it('pairs a due pending membership with the member’s active membership', async () => {
    const { supabase } = makeSupabase({
      memberships: [{ data: [OUTGOING_ACTIVE], error: null }],
    });

    const { candidates } = await listSupersedeCandidates(supabase, [DUE_ROW]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      incoming_membership_id: 'mem-new',
      outgoing_membership_id: 'mem-old',
      outgoing_enrollment_id: 'enr-old',
      incoming_effective_date: '2026-09-01',
    });
  });

  it('returns no candidates for a first activation (no active membership)', async () => {
    const { supabase } = makeSupabase({
      memberships: [{ data: [], error: null }],
    });
    const { candidates } = await listSupersedeCandidates(supabase, [DUE_ROW]);
    expect(candidates).toHaveLength(0);
  });

  it('with a scheduled_change back-pointer, only the targeted membership is superseded', async () => {
    const scheduledDue = {
      ...DUE_ROW,
      enrollment_id: null,
      custom_fields: { scheduled_change: { from_membership_id: 'mem-old' } },
    };
    const otherActive = { id: 'mem-other', member_id: 'member-1', enrollment_id: null, end_date: null };
    const { supabase } = makeSupabase({
      memberships: [{ data: [OUTGOING_ACTIVE, otherActive], error: null }],
    });

    const { candidates } = await listSupersedeCandidates(supabase, [scheduledDue]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].outgoing_membership_id).toBe('mem-old');
  });
});

describe('applyDueMembershipActivation — supersede pass', () => {
  it('terminates the outgoing membership, cancels its schedule, activates, and refreshes the member', async () => {
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: [DUE_ROW], error: null }, // due list
        { data: [OUTGOING_ACTIVE], error: null }, // active list
        { data: null, error: null }, // supersede_outgoing stamp on incoming
        { data: [{ id: 'mem-old' }], error: null }, // terminate update (1 row)
        { data: [{ id: 'mem-new' }], error: null }, // activate-by-id update
      ],
      billing_schedules: [
        { data: [{ id: 'sched-new' }], error: null }, // incoming schedule lookup
        { data: [{ id: 'sched-old' }], error: null }, // cancel update
      ],
      plans: [{ data: { name: 'Premium Care' }, error: null }],
      members: [
        { data: null, error: null }, // plan_name/monthly_share refresh
        { data: [], error: null }, // pending→active flip (member already active)
      ],
    });

    const result = await applyDueMembershipActivation(supabase, '2026-09-01', { supersede: true });

    expect(result.error).toBeUndefined();
    expect(result.supersede_errors).toEqual([]);
    expect(result.memberships_superseded).toBe(1);
    expect(result.schedules_cancelled).toBe(1);
    expect(result.memberships_activated).toBe(1);

    const terminate = ops.find(
      (o) =>
        o.table === 'memberships' &&
        o.kind === 'update' &&
        o.values?.status === 'terminated',
    );
    expect(terminate?.values).toMatchObject({
      end_date: '2026-08-31',
      cancellation_reason: 'superseded_by_scheduled_change',
    });
    expect(terminate?.filters).toContainEqual({ method: 'eq', column: 'id', value: 'mem-old' });

    const cancel = ops.find(
      (o) => o.table === 'billing_schedules' && o.kind === 'update',
    );
    expect(cancel?.values).toMatchObject({ status: 'cancelled' });
    expect(cancel?.filters).toContainEqual({ method: 'eq', column: 'enrollment_id', value: 'enr-old' });

    // Terminate must precede activate; activation is pinned by id.
    const terminateIdx = ops.indexOf(terminate!);
    const activate = ops.find(
      (o) => o.table === 'memberships' && o.kind === 'update' && o.values?.status === 'active',
    );
    expect(ops.indexOf(activate!)).toBeGreaterThan(terminateIdx);
    expect(activate?.filters).toContainEqual({ method: 'eq', column: 'id', value: 'mem-new' });

    const memberRefresh = ops.find(
      (o) => o.table === 'members' && o.kind === 'update' && o.values?.plan_name,
    );
    expect(memberRefresh?.values).toMatchObject({ plan_name: 'Premium Care', monthly_share: 350 });
    expect(memberRefresh?.values?.effective_date).toBeUndefined();

    expect(recalculateMemberBillingFromCoverage).toHaveBeenCalledWith(supabase, 'member-1', 'org-1');
  });

  it('keeps the existing schedule for a staff-scheduled change (no incoming enrollment)', async () => {
    const staffDue = { ...DUE_ROW, enrollment_id: null };
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: [staffDue], error: null },
        { data: [OUTGOING_ACTIVE], error: null },
        { data: null, error: null }, // stamp
        { data: [{ id: 'mem-old' }], error: null }, // terminate
        { data: [{ id: 'mem-new' }], error: null }, // activate
      ],
      plans: [{ data: { name: 'Premium Care' }, error: null }],
      members: [
        { data: null, error: null }, // refresh
        { data: [], error: null }, // flip
      ],
    });

    const result = await applyDueMembershipActivation(supabase, '2026-09-01', { supersede: true });

    expect(result.error).toBeUndefined();
    expect(result.memberships_superseded).toBe(1);
    expect(result.schedules_cancelled).toBe(0);
    expect(ops.some((o) => o.table === 'billing_schedules')).toBe(false);
  });

  it('a failed supersede leaves the pending row unactivated (retried next run)', async () => {
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: [DUE_ROW], error: null }, // due list
        { data: [OUTGOING_ACTIVE], error: null }, // active list
        { data: null, error: null }, // stamp
        { data: [], error: null }, // terminate matches 0 rows
        { data: { status: 'active', cancellation_reason: null }, error: null }, // raced — not our partial run
      ],
    });

    const result = await applyDueMembershipActivation(supabase, '2026-09-01', { supersede: true });

    expect(result.memberships_superseded).toBe(0);
    expect(result.memberships_activated).toBe(0);
    expect(result.supersede_errors).toHaveLength(1);
    expect(
      ops.some((o) => o.kind === 'update' && o.values?.status === 'active'),
    ).toBe(false);
  });

  it('resumes a partial supersede on retry via the back-pointer (outgoing already terminated)', async () => {
    const resumeDue = {
      ...DUE_ROW,
      enrollment_id: null,
      custom_fields: { scheduled_change: { from_membership_id: 'mem-old' } },
    };
    const { supabase } = makeSupabase({
      memberships: [
        { data: [resumeDue], error: null }, // due list
        { data: [], error: null }, // active list — outgoing already terminated
        {
          // pointed fetch by id (any status)
          data: [
            {
              id: 'mem-old',
              member_id: 'member-1',
              enrollment_id: 'enr-old',
              end_date: '2026-08-31',
              status: 'terminated',
              cancellation_reason: 'superseded_by_scheduled_change',
            },
          ],
          error: null,
        },
        { data: [], error: null }, // terminate matches 0 rows
        {
          // existing check: our prior partial run → resume
          data: { status: 'terminated', cancellation_reason: 'superseded_by_scheduled_change' },
          error: null,
        },
        { data: [{ id: 'mem-new' }], error: null }, // activate
      ],
      plans: [{ data: { name: 'Premium Care' }, error: null }],
      members: [
        { data: null, error: null }, // refresh
        { data: [], error: null }, // flip
      ],
    });

    const result = await applyDueMembershipActivation(supabase, '2026-09-01', { supersede: true });

    expect(result.error).toBeUndefined();
    expect(result.supersede_errors).toEqual([]);
    expect(result.memberships_superseded).toBe(1);
    expect(result.memberships_activated).toBe(1);
    expect(recalculateMemberBillingFromCoverage).toHaveBeenCalledWith(supabase, 'member-1', 'org-1');
  });

  it('plain activation is pinned to the vetted due ids, not a blanket status update', async () => {
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: [DUE_ROW], error: null }, // due list
        { data: [], error: null }, // no active sibling → no candidates
        { data: [{ id: 'mem-new', member_id: 'member-1' }], error: null }, // pinned activate
      ],
      members: [{ data: [{ id: 'member-1' }], error: null }],
    });

    const result = await applyDueMembershipActivation(supabase, '2026-09-01', { supersede: true });

    expect(result.memberships_activated).toBe(1);
    expect(result.members_activated).toBe(1);
    const activate = ops.find(
      (o) => o.table === 'memberships' && o.kind === 'update' && o.values?.status === 'active',
    );
    expect(activate?.filters).toContainEqual({ method: 'in', column: 'id', value: ['mem-new'] });
  });

  it('skips the supersede pass entirely when disabled', async () => {
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: [DUE_ROW], error: null },
        { data: [{ id: 'mem-new', member_id: 'member-1' }], error: null }, // pinned activate
      ],
      members: [{ data: [{ id: 'member-1' }], error: null }],
    });

    const result = await applyDueMembershipActivation(supabase, '2026-09-01', { supersede: false });

    expect(result.memberships_superseded).toBe(0);
    expect(result.memberships_activated).toBe(1);
    expect(
      ops.some((o) => o.kind === 'update' && o.values?.status === 'terminated'),
    ).toBe(false);
  });

  it('reports supersede counts in dry_run without mutating', async () => {
    const { supabase, ops } = makeSupabase({
      memberships: [
        { data: [DUE_ROW], error: null },
        { data: [OUTGOING_ACTIVE], error: null },
      ],
    });

    const result = await applyDueMembershipActivation(supabase, '2026-09-01', {
      dryRun: true,
      supersede: true,
    });

    expect(result.memberships_to_supersede).toBe(1);
    expect(result.memberships_superseded).toBe(0);
    expect(ops.every((o) => o.kind === 'select')).toBe(true);
  });
});
