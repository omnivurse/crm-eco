import 'server-only';

/**
 * Applicant-facing more-info reader (SLICE E5).
 * ----------------------------------------------------------------
 * The member portal needs to show the enrollee the more_info_request the admin
 * raised (and any prior applicant_response rows). But `enrollment_reviews` has
 * NO applicant RLS policy — only the admin-tenant view/manage policies and the
 * service_role bypass (see supabase/drafts/202606240005_enrollment_approvals_
 * parallel_binding.sql + the live policies on the table). So this reader:
 *
 *   1. Resolves the member context via requireActiveMembership() (the same auth
 *      gate every member surface uses).
 *   2. Verifies the enrollment BELONGS to that member IN CODE (primary_member_id
 *      === member.id AND organization_id === member.organization_id) — fail
 *      CLOSED: if not owned / not found we return an empty payload and never run
 *      the privileged read.
 *   3. ONLY THEN reads the applicant-visible review rows with the service-role
 *      client, projecting a minimal column set. It NEVER selects internal rows
 *      (visibility is hard-filtered to 'applicant'), and NEVER selects context /
 *      entity_snapshot / decision internals (those columns live on
 *      enrollment_approvals, not enrollment_reviews, but the explicit projection
 *      keeps the leak surface zero regardless).
 *
 * Degrade-to-empty: enrollment_reviews is a D-slice draft table not yet on prod;
 * a missing-table / RLS error must not crash the member surface, so the read is
 * wrapped and falls back to an empty list. (Mirrors the Promise.allSettled /
 * maybeSingle degrade posture used across the E surfaces.)
 */

import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

export interface ApplicantReview {
  id: string;
  kind: string;
  body: string | null;
  requested_fields: string[];
  created_at: string;
  author_profile_id: string | null;
}

export interface ApplicantReviewsResult {
  /** The verified-owned enrollment summary, or null when not owned / not found. */
  enrollment: { id: string; status: string } | null;
  /** Applicant-visible review thread, oldest first. Empty when not owned. */
  reviews: ApplicantReview[];
}

const EMPTY: ApplicantReviewsResult = { enrollment: null, reviews: [] };

/**
 * Return the applicant-visible review thread for an enrollment the current
 * member owns. Fails CLOSED (empty payload) for any ownership / lookup miss.
 */
export async function getApplicantReviews(
  enrollmentId: string,
): Promise<ApplicantReviewsResult> {
  if (!enrollmentId) return EMPTY;

  // (1) Auth gate — resolves { member, profile } or redirects (login/access-denied).
  const ctx = await requireActiveMembership();

  // (2) Verify ownership IN CODE before any privileged read. We use the
  //     request-scoped service-role client ONLY to look up the ownership keys,
  //     then assert them against the member context. Fail closed on any miss.
  const service = createServiceRoleClient();

  let owned: { id: string; status: string } | null = null;
  try {
    const { data: enrollment } = await (service as any)
      .from('enrollments')
      .select('id, status, primary_member_id, organization_id')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (
      enrollment &&
      enrollment.primary_member_id === ctx.member.id &&
      enrollment.organization_id === ctx.member.organization_id
    ) {
      owned = { id: enrollment.id, status: enrollment.status };
    }
  } catch {
    // Lookup failure -> fail closed.
    return EMPTY;
  }

  if (!owned) return EMPTY;

  // (3) Privileged read of ONLY the applicant-visible review rows. Explicit,
  //     minimal projection — never internal rows, never context/entity_snapshot.
  try {
    const { data: rows } = await (service as any)
      .from('enrollment_reviews')
      .select('id, kind, body, requested_fields, created_at, author_profile_id')
      .eq('enrollment_id', enrollmentId)
      .eq('visibility', 'applicant')
      .order('created_at', { ascending: true });

    const reviews: ApplicantReview[] = (rows ?? []).map(
      (r: {
        id: string;
        kind: string;
        body: string | null;
        requested_fields: unknown;
        created_at: string;
        author_profile_id: string | null;
      }) => ({
        id: r.id,
        kind: r.kind,
        body: r.body,
        requested_fields: Array.isArray(r.requested_fields)
          ? (r.requested_fields as string[])
          : [],
        created_at: r.created_at,
        author_profile_id: r.author_profile_id,
      }),
    );

    return { enrollment: owned, reviews };
  } catch {
    // Draft table absent on prod -> degrade to the owned enrollment with no thread.
    return { enrollment: owned, reviews: [] };
  }
}
