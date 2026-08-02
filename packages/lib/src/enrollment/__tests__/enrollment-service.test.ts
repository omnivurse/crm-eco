/**
 * Characterization tests for EnrollmentService state-machine logic.
 *
 * Supabase + the audit logger are mocked, so these are fast, hermetic, and
 * assert the CURRENT control flow:
 *   - cancelEnrollment refuses an already-cancelled enrollment
 *   - createEnrollment maps the (mistyped) `baseMonthlyCoat` field to the
 *     RPC's `base_monthly_cost` and applies the documented defaults
 *   - (activateFutureEnrollment removed — coverage uses finalize + cron)
 *
 * KNOWN FINDING locked here: the public payload field is `baseMonthlyCoat`
 * (typo of "Cost"). Renaming it is a safe, test-covered follow-up.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../audit', () => ({
  logEnrollmentAudit: vi.fn(async () => undefined),
}));

import { EnrollmentService } from '../enrollment-service';
import { logEnrollmentAudit } from '../audit';

type QueuedResult = { data: unknown; error: unknown };

/**
 * Minimal chainable Supabase stub.
 * - `.select().eq()....single()` resolves the next item from `selectQueue`.
 * - `.update(vals).eq()` is awaited directly and resolves `updateResult`;
 *   the `vals` passed to update() are recorded for assertions.
 * - `.rpc(fn, args)` records the call and resolves `rpcResult`.
 */
function makeSupabase(opts: {
  selectQueue?: QueuedResult[];
  updateResult?: { error: unknown };
  rpcResult?: QueuedResult;
} = {}) {
  const selectQueue = [...(opts.selectQueue ?? [])];
  const updateResult = opts.updateResult ?? { error: null };
  const rpcResult = opts.rpcResult ?? { data: { enrollment_id: 'enr_new' }, error: null };
  const updates: Record<string, unknown>[] = [];
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

  function builder() {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.update = (vals: Record<string, unknown>) => {
      updates.push(vals);
      return b;
    };
    b.single = () =>
      Promise.resolve(selectQueue.shift() ?? { data: null, error: { message: 'no result queued' } });
    // Make the builder awaitable for the `update().eq()` path.
    b.then = (resolve: (v: unknown) => unknown) => resolve(updateResult);
    return b;
  }

  const supabase = {
    from: () => builder(),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
  };

  return { supabase, updates, rpcCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EnrollmentService.cancelEnrollment', () => {
  it('throws when the enrollment is already cancelled and performs no update', async () => {
    const { supabase, updates } = makeSupabase({
      selectQueue: [{ data: { status: 'cancelled' }, error: null }],
    });
    const svc = new EnrollmentService(supabase as never);

    await expect(
      svc.cancelEnrollment({ enrollmentId: 'e1', organizationId: 'o1', inactiveReason: 'x' })
    ).rejects.toThrow(/already cancelled/i);

    expect(updates).toHaveLength(0);
    expect(logEnrollmentAudit).not.toHaveBeenCalled();
  });

  it('sets status=cancelled with the reason and writes an audit row', async () => {
    const { supabase, updates } = makeSupabase({
      selectQueue: [{ data: { status: 'active' }, error: null }],
    });
    const svc = new EnrollmentService(supabase as never);

    await svc.cancelEnrollment({
      enrollmentId: 'e1',
      organizationId: 'o1',
      inactiveReason: 'voluntary',
    });

    expect(updates[0]).toMatchObject({ status: 'cancelled', inactive_reason: 'voluntary' });
    expect(logEnrollmentAudit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'cancelled', newStatus: 'cancelled' })
    );
  });
});

describe('EnrollmentService.createEnrollment', () => {
  it('maps payload to create_enrollment_tx with documented defaults', async () => {
    const { supabase, rpcCalls } = makeSupabase({
      rpcResult: { data: { enrollment_id: 'enr_1' }, error: null },
      selectQueue: [{ data: { id: 'enr_1', status: 'draft' }, error: null }], // fetch-after-create
    });
    const svc = new EnrollmentService(supabase as never);

    await svc.createEnrollment({
      organizationId: 'o1',
      primaryMemberId: 'm1',
      selectedPlanId: 'p1',
      effectiveDate: '2026-06-01',
      baseMonthlyCoat: 199, // NOTE: mistyped field name — locked by this test
    });

    expect(rpcCalls[0].fn).toBe('create_enrollment_tx');
    expect(rpcCalls[0].args.p_org_id).toBe('o1');
    expect(rpcCalls[0].args.p_payload).toMatchObject({
      primary_member_id: 'm1',
      selected_plan_id: 'p1',
      effective_date: '2026-06-01',
      base_monthly_cost: 199,
      household_size: 1,
      permanent_bill_day: 20,
      enrollment_source: 'admin',
      channel: 'direct',
    });
  });
});
