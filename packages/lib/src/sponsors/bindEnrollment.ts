import type { SupabaseClient } from '@supabase/supabase-js';
import { matchSponsorEnrollment, attachSponsorshipAfterMatch } from './sponsor-service';
import { computeSponsorStartDate, earliestBackbillStart } from './cutoff';
import { loadSponsorEnrollmentFilter } from './landingPlans';

type AnyClient = SupabaseClient;

/**
 * After a public enroll submit: if the landing page belongs to a sponsor,
 * match FN/LN/DOB to the roster. Match → attach sponsorship. Miss → hold
 * for employer approval. Never throws to the caller.
 */
export async function bindSponsorEnrollmentAfterSubmit(
  supabase: AnyClient,
  input: {
    organizationId: string;
    enrollmentId: string;
    memberId: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
    landingSlug?: string | null;
    requestedEffectiveDate?: string | null;
    householdDependents?: number;
    selectedPlanId?: string | null;
  }
): Promise<{ sponsorId: string | null; outcome: string }> {
  try {
    if (!input.landingSlug) return { sponsorId: null, outcome: 'no_sponsor' };

    const { data: landing } = await supabase
      .from('landing_pages')
      .select('id, sponsor_id')
      .eq('organization_id', input.organizationId)
      .eq('slug', input.landingSlug)
      .maybeSingle();

    const sponsorId = (landing as { sponsor_id?: string | null } | null)?.sponsor_id ?? null;
    if (!sponsorId) return { sponsorId: null, outcome: 'no_sponsor' };

    const { data: sponsor } = await supabase
      .from('sponsors')
      .select('id, enrollment_cutoff_day, backbill_months, dependent_cap')
      .eq('id', sponsorId)
      .eq('organization_id', input.organizationId)
      .maybeSingle();

    const decision = await matchSponsorEnrollment(supabase, {
      organizationId: input.organizationId,
      sponsorId,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
    });

    const requested = input.requestedEffectiveDate || new Date().toISOString().slice(0, 10);
    const cutoff = sponsor?.enrollment_cutoff_day ?? 1;
    const start = earliestBackbillStart(
      computeSponsorStartDate(requested, cutoff),
      sponsor?.backbill_months ?? 6,
      new Date().toISOString().slice(0, 10)
    );

    const planFilter = await loadSponsorEnrollmentFilter(supabase, sponsorId);
    const planNotAllowed = Boolean(
      input.selectedPlanId &&
        planFilter.sponsorPlanIds.length > 0 &&
        !planFilter.sponsorPlanIds.includes(input.selectedPlanId)
    );
    const overCap =
      sponsor?.dependent_cap != null &&
      (input.householdDependents ?? 0) > sponsor.dependent_cap;
    const needsApproval = decision.outcome !== 'matched' || overCap || planNotAllowed;
    const statusReason = planNotAllowed
      ? 'Selected plan is not available for this sponsor'
      : overCap
        ? `Household exceeds dependent cap (${sponsor?.dependent_cap})`
        : decision.outcome === 'matched'
          ? `Matched sponsor roster ${decision.roster?.roster_id}`
          : decision.reason;

    await supabase
      .from('enrollments')
      .update({
        sponsor_id: sponsorId,
        ...(needsApproval
          ? { status: 'pending_review', status_reason: statusReason }
          : { requested_effective_date: start }),
      })
      .eq('id', input.enrollmentId);

    if (decision.roster?.roster_id) {
      await attachSponsorshipAfterMatch(supabase, {
        organizationId: input.organizationId,
        sponsorId,
        rosterId: decision.roster.roster_id,
        memberId: input.memberId,
        enrollmentId: input.enrollmentId,
        role: decision.roster.relationship,
        effectiveDate: start,
        needsApproval,
      });
    } else if (needsApproval) {
      await supabase.from('sponsorships').insert({
        organization_id: input.organizationId,
        sponsor_id: sponsorId,
        member_id: input.memberId,
        enrollment_id: input.enrollmentId,
        role: 'employee',
        status: 'needs_approval',
        effective_date: start,
      });
    }

    await supabase.from('enrollment_audit_log').insert({
      organization_id: input.organizationId,
      enrollment_id: input.enrollmentId,
      event_type: 'sponsor_match',
      message: statusReason,
      data_after: { sponsor_id: sponsorId, outcome: decision.outcome },
    });

    return { sponsorId, outcome: decision.outcome };
  } catch {
    return { sponsorId: null, outcome: 'error' };
  }
}
