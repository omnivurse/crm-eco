/**
 * Durable enrollment-submission workflow (Vercel Workflow DevKit).
 *
 * The CANONICAL enrollment-create path. Wraps the atomic, idempotent Postgres
 * RPC `create_enrollment_tx` as a retryable step and recalculates billing — so
 * the ~6 ad-hoc create paths the audit found (CRM wizard inserts, portal
 * self-serve inserts, inline RPC calls in the submit/public routes) can collapse
 * onto one durable, observable, idempotent pipeline that both admin and the
 * member portal invoke via `start()`.
 *
 * NOT yet wired to the live /api/enroll/submit route — cutover is a separate,
 * gated step. The RPC stays the source of atomic truth; this workflow adds
 * durability, retries, and observability around it.
 *
 * Steps run in their own request with full Node access; the workflow function is
 * pure orchestration (sandboxed). See node_modules/workflow/docs.
 */
import { RetryableError } from 'workflow';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { recalculateMemberBillingFromCoverage } from '@crm-eco/lib';

export interface EnrollmentSubmissionPayload {
  primary_member_id: string;
  selected_plan_id: string;
  effective_date: string;
  advisor_id?: string | null;
  household_size?: number;
  base_monthly_cost?: number;
  permanent_bill_day?: number;
  enrollment_source?: string;
  channel?: string;
  custom_fields?: Record<string, unknown>;
  dependents?: unknown[];
  /** REQUIRED for idempotency — same key returns the same enrollment on replay. */
  idempotency_key: string;
}

export interface EnrollmentSubmissionResult {
  enrollmentId: string;
  idempotentReplay: boolean;
  billingRecalculated: boolean;
}

export async function enrollmentSubmission(input: {
  orgId: string;
  payload: EnrollmentSubmissionPayload;
}): Promise<EnrollmentSubmissionResult> {
  'use workflow';

  const created = await createEnrollmentStep(input.orgId, input.payload);
  const billingRecalculated = await recalcBillingStep(input.orgId, input.payload.primary_member_id);

  return {
    enrollmentId: created.enrollmentId,
    idempotentReplay: created.idempotentReplay,
    billingRecalculated,
  };
}

/**
 * Create the enrollment via the atomic, idempotent RPC. Safe to retry: the RPC's
 * idempotency_key fast-path returns the existing enrollment instead of creating
 * a duplicate, and it handles the concurrent-insert race internally.
 */
async function createEnrollmentStep(
  orgId: string,
  payload: EnrollmentSubmissionPayload,
): Promise<{ enrollmentId: string; idempotentReplay: boolean }> {
  'use step';

  if (!payload.idempotency_key) {
    throw new RetryableError('enrollment payload missing idempotency_key');
  }

  const supabase = createServiceRoleClient();
  // p_payload is typed as the generated `Json` union; `never` is assignable to
  // it without pulling the Json type or using `any`.
  const { data, error } = await supabase.rpc('create_enrollment_tx', {
    p_org_id: orgId,
    p_payload: payload as unknown as never,
  });

  if (error) {
    // Transient/DB errors retry; the RPC is idempotent so retries can't dupe.
    throw new RetryableError(`create_enrollment_tx failed: ${error.message}`);
  }

  const row = (data ?? {}) as { enrollment_id?: string; idempotent_replay?: boolean };
  if (!row.enrollment_id) {
    throw new RetryableError('create_enrollment_tx returned no enrollment_id');
  }

  return { enrollmentId: row.enrollment_id, idempotentReplay: Boolean(row.idempotent_replay) };
}

/**
 * Recalculate billing from the member's coverage after enrollment. Non-fatal:
 * a recalc miss must not fail an already-created enrollment (the enrollment is
 * the durable outcome); we report whether it succeeded.
 */
async function recalcBillingStep(orgId: string, memberId: string): Promise<boolean> {
  'use step';
  try {
    const supabase = createServiceRoleClient();
    await recalculateMemberBillingFromCoverage(supabase, memberId, orgId);
    return true;
  } catch (e) {
    console.error('[enrollmentSubmission] billing recalc failed (non-fatal)', e);
    return false;
  }
}
