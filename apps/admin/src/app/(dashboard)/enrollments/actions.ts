'use server';

/**
 * Enrollment decision server actions (admin)
 * ----------------------------------------------------------------
 * PARALLEL-BINDING decision path. A single open `enrollment_approvals` row (created
 * by the flag-gated submit-route hook, apps/portal/.../enroll/submit/route.ts, OR
 * absent entirely for manually-triaged enrollments) is resolved here in lockstep
 * with the `enrollments.status` transition, a threaded `enrollment_reviews` note,
 * and an `enrollment_audit_log` entry.
 *
 * WHY a server action (mirrors settings/actions.ts, questionnaires/actions.ts):
 *   - Uses `createServerSupabaseClient()` (cookie/SSR client, NOT service-role) so
 *     the database RLS policies remain the real gatekeeper:
 *       * enrollments        → "Admins can manage enrollments" (is_admin + org)
 *       * enrollment_approvals / enrollment_reviews → the admin-tenant policies in
 *         supabase/drafts/202606240005_enrollment_approvals_parallel_binding.sql
 *         ("Admins can manage ...", organization_id = get_user_organization_id()).
 *   - `getActiveTenant()` resolves + verifies the org and the caller's role; the
 *     app-level role check below is defense-in-depth (RLS is authoritative).
 *   - Keeps optimistic concurrency server-side via `guaranteedUpdateWithVersion`,
 *     and lets ONE resolved (tenant, profile) drive every write so the approval row,
 *     the review note, and the audit log are mutually consistent.
 *
 * SAFETY:
 *   - crm_approvals / crm_records are NEVER touched (parallel binding only).
 *   - Status writes go through `guaranteedUpdateWithVersion` so a concurrent admin
 *     action surfaces a CONFLICT instead of silently overwriting.
 *   - The `enrollment_logs` AFTER-trigger (log_enrollment_status_change) already
 *     records status changes DB-side; this action does NOT write enrollment_logs to
 *     avoid a duplicate. It writes enrollment_audit_log (the additive admin trail),
 *     exactly like the prior client path.
 *   - more_info_request review rows are visibility='applicant' so the enrollee can
 *     see what is being asked. decision_note rows are visibility='internal'.
 */

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { guaranteedUpdateWithVersion } from '@crm-eco/lib';
import { getActiveTenant, type TenantRole } from '@/lib/tenant';

/** Roles allowed to decide an enrollment. Mirrors the enrollments admin RLS
 *  (is_admin = admin/super_admin) plus staff/owner who can manage the queue. */
const DECISION_ROLES: readonly TenantRole[] = ['owner', 'super_admin', 'admin', 'staff'];

export type DecideEnrollmentError =
  | 'unauthorized'
  | 'no_tenant'
  | 'forbidden'
  | 'reason_required'
  | 'update_failed'
  | 'conflict';

export type DecideEnrollmentResult =
  | { ok: true; status: string }
  | { ok: false; error: DecideEnrollmentError; message?: string };

type Decision = 'approve' | 'reject' | 'more_info';

type SsrClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface ResolvedActor {
  supabase: SsrClient;
  tenant: NonNullable<Awaited<ReturnType<typeof getActiveTenant>>>;
  profileId: string;
  organizationId: string;
}

/**
 * Resolve (supabase client, tenant, actor profile id) once and enforce the role
 * gate. Returns a discriminated result so each public action can early-return a
 * friendly error instead of bouncing off an RLS 403. The created cookie/SSR client
 * is returned so every downstream write reuses the SAME request-scoped session.
 */
async function resolveActor(): Promise<
  { ok: true; actor: ResolvedActor } | { ok: false; error: DecideEnrollmentError }
> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: 'no_tenant' };

  if (!DECISION_ROLES.includes(tenant.role)) {
    return { ok: false, error: 'forbidden' };
  }

  // Resolve the acting profile id within this tenant (actor_profile_id / decided_by).
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .single();

  if (!profile) return { ok: false, error: 'unauthorized' };

  return {
    ok: true,
    actor: {
      supabase,
      tenant,
      profileId: (profile as { id: string }).id,
      organizationId: tenant.organizationId,
    },
  };
}

/**
 * Map a decision onto the enrollment status + the parallel approval status +
 * the review-thread row kind/visibility.
 */
const DECISION_MAP: Record<
  Decision,
  {
    enrollmentStatus: 'approved' | 'rejected' | 'more_info';
    approvalStatus: 'approved' | 'rejected' | 'changes_requested';
    reviewKind: 'decision_note' | 'more_info_request';
    reviewVisibility: 'internal' | 'applicant';
    auditEvent: string;
  }
> = {
  approve: {
    enrollmentStatus: 'approved',
    approvalStatus: 'approved',
    reviewKind: 'decision_note',
    reviewVisibility: 'internal',
    auditEvent: 'status_change',
  },
  reject: {
    enrollmentStatus: 'rejected',
    approvalStatus: 'rejected',
    reviewKind: 'decision_note',
    reviewVisibility: 'internal',
    auditEvent: 'status_change',
  },
  more_info: {
    enrollmentStatus: 'more_info',
    approvalStatus: 'changes_requested',
    reviewKind: 'more_info_request',
    reviewVisibility: 'applicant',
    auditEvent: 'more_info_request',
  },
};

/**
 * Core decision routine shared by all three public actions.
 *
 * Order of writes (each subsequent write keyed off the already-resolved actor):
 *   1. enrollments.status via guaranteedUpdateWithVersion (optimistic concurrency,
 *      explicit org scope on organization_id). Reason fields stamped per-decision.
 *   2. resolve the OPEN enrollment_approvals row (status -> approved/rejected/
 *      changes_requested + decided_by/decided_at/resolved_by/resolved_at + reason).
 *      Best-effort: a manually-triaged enrollment may have NO open approval row.
 *   3. insert an enrollment_reviews row (decision_note internal / more_info_request
 *      applicant + requested_fields).
 *   4. insert the enrollment_audit_log row (the additive admin trail).
 *   5. revalidate the detail page.
 */
async function decide(
  enrollmentId: string,
  decision: Decision,
  opts: {
    reason?: string;
    requestedFields?: string[];
    expectedUpdatedAt?: string | null;
    currentStatus?: string;
  } = {},
): Promise<DecideEnrollmentResult> {
  const resolved = await resolveActor();
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const { actor } = resolved;
  const { supabase } = actor;

  const map = DECISION_MAP[decision];
  const reason = opts.reason?.trim() || null;

  // reject + more_info require a reason / message so the enrollee (more_info) or
  // the audit trail (reject) has the why. approve may be reasonless.
  if ((decision === 'reject' || decision === 'more_info') && !reason) {
    return { ok: false, error: 'reason_required' };
  }

  // (1) Transition the enrollment status with optimistic concurrency. Pass the org
  //     scope EXPLICITLY (enrollments uses organization_id, not the helper's org_id
  //     default) — RLS still applies on top. Stamp the per-decision reason field;
  //     the BEFORE trigger owns the *_at timestamp.
  const statusUpdates: Record<string, unknown> = { status: map.enrollmentStatus };
  if (decision === 'approve') {
    statusUpdates.approved_by = actor.profileId;
  } else if (decision === 'reject') {
    statusUpdates.rejection_reason = reason;
    statusUpdates.status_reason = reason;
  } else if (decision === 'more_info') {
    statusUpdates.status_reason = reason;
  }

  const updateResult = await guaranteedUpdateWithVersion(
    supabase,
    'enrollments',
    enrollmentId,
    statusUpdates,
    {
      orgColumn: 'organization_id',
      orgId: actor.organizationId,
      expectedUpdatedAt: opts.expectedUpdatedAt ?? undefined,
    },
  );

  if (!updateResult.ok) {
    if (updateResult.code === 'CONFLICT') {
      return { ok: false, error: 'conflict', message: updateResult.error };
    }
    return { ok: false, error: 'update_failed', message: updateResult.error };
  }

  const oldStatus = opts.currentStatus ?? null;
  const nowIso = new Date().toISOString();

  // (2) Resolve the OPEN parallel-binding approval row, if one exists. Best-effort:
  //     manual triage (an enrollment that never matched a rule) has no open row, so a
  //     zero-row update is expected and non-fatal. RLS-scoped via the cookie client;
  //     we also scope by organization_id explicitly as defense-in-depth.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- draft-only
    // table (enrollment_approvals) not yet in the generated Database type; matches
    // the codebase convention for not-yet-shipped tables (see questionnaire actions).
    await (supabase as any)
      .from('enrollment_approvals')
      .update({
        status: map.approvalStatus,
        resolved_by: actor.profileId,
        resolved_at: nowIso,
        decided_by: actor.profileId,
        decided_at: nowIso,
        decision_reason: reason,
      })
      .eq('enrollment_id', enrollmentId)
      .eq('organization_id', actor.organizationId)
      .eq('status', 'pending');
  } catch {
    // A missing/locked approval row must not abort the decision — the enrollment
    // status change is the source of truth; the approval row is the parallel mirror.
  }

  // (3) Insert the review-thread row (decision_note internal / more_info_request
  //     applicant). requested_fields only populated for more_info.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- draft-only table
    await (supabase as any).from('enrollment_reviews').insert({
      organization_id: actor.organizationId,
      enrollment_id: enrollmentId,
      kind: map.reviewKind,
      visibility: map.reviewVisibility,
      body: reason,
      requested_fields:
        decision === 'more_info' ? (opts.requestedFields ?? []) : [],
      author_profile_id: actor.profileId,
    });
  } catch {
    // A failed review-note insert must not roll back an already-committed status
    // change; the audit log below still records the decision.
  }

  // (4) Audit log (additive admin trail). Free-text event_type (no CHECK in baseline).
  try {
    await supabase.from('enrollment_audit_log').insert({
      organization_id: actor.organizationId,
      enrollment_id: enrollmentId,
      actor_profile_id: actor.profileId,
      event_type: map.auditEvent,
      old_status: oldStatus,
      new_status: map.enrollmentStatus,
      message:
        decision === 'more_info'
          ? `Requested more info${reason ? `: ${reason}` : ''}`
          : `Status changed${oldStatus ? ` from ${oldStatus}` : ''} to ${map.enrollmentStatus}${reason ? ` — ${reason}` : ''}`,
      data_after:
        decision === 'more_info'
          ? { requested_fields: opts.requestedFields ?? [] }
          : null,
    });
  } catch {
    // Audit log is non-fatal — never roll back the decision over a log write.
  }

  // (5) Re-render the detail page (replaces the client router.refresh()).
  revalidatePath(`/enrollments/${enrollmentId}`);

  return { ok: true, status: map.enrollmentStatus };
}

/**
 * Approve an enrollment. Resolves the open approval row to 'approved', moves the
 * enrollment to 'approved' (stamps approved_by), records an internal decision note.
 */
export async function approveEnrollment(
  enrollmentId: string,
  reason?: string,
  expectedUpdatedAt?: string | null,
  currentStatus?: string,
): Promise<DecideEnrollmentResult> {
  return decide(enrollmentId, 'approve', { reason, expectedUpdatedAt, currentStatus });
}

/**
 * Reject an enrollment. Reason REQUIRED. Resolves the open approval row to
 * 'rejected', moves the enrollment to 'rejected' (stamps rejection_reason), records
 * an internal decision note.
 */
export async function rejectEnrollment(
  enrollmentId: string,
  reason: string,
  expectedUpdatedAt?: string | null,
  currentStatus?: string,
): Promise<DecideEnrollmentResult> {
  return decide(enrollmentId, 'reject', { reason, expectedUpdatedAt, currentStatus });
}

/**
 * Request more info from the enrollee. Message REQUIRED. Resolves the open approval
 * row to 'changes_requested', moves the enrollment to 'more_info', and records an
 * APPLICANT-VISIBLE more_info_request review row carrying the requested fields so the
 * enrollee sees exactly what to supply.
 *
 * `respondMoreInfo` is the portal/enrollee side and is intentionally out of scope here.
 */
export async function requestMoreInfo(
  enrollmentId: string,
  requestedFields: string[],
  message: string,
  expectedUpdatedAt?: string | null,
  currentStatus?: string,
): Promise<DecideEnrollmentResult> {
  return decide(enrollmentId, 'more_info', {
    reason: message,
    requestedFields,
    expectedUpdatedAt,
    currentStatus,
  });
}
