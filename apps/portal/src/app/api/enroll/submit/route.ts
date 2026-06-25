import { NextRequest, NextResponse } from 'next/server';
import {
  pickActiveMemberByName,
  checkEligibility,
  buildEnrollmentApprovalRecord,
  checkEnrollmentApprovalRequired,
} from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { quote, buildRateConfigFromDb } from '@crm-eco/rates';
import type { CoverageTier, QuoteInput } from '@crm-eco/rates/types';
import { readDraftFromRequest, clearDraftCookie } from '@/lib/enroll/draft-cookie';
import { verifyRecaptchaToken } from '@/lib/enroll/recaptcha';

// MONEY-TOUCHING: persisting the engine-computed base_monthly_cost is only done
// when this flag is explicitly enabled. Defaults OFF — when off, this path keeps
// its prior behavior and uses plans.monthly_share. (This route only ever creates
// a NEW draft enrollment via create_enrollment_tx, so the billing-cost sync
// trigger is a no-op here; this is not a bulk backfill.)
const RATE_ENGINE_WRITE_ENABLED = process.env.RATE_ENGINE_WRITE_ENABLED === 'true';

// STATE-TOUCHING: auto-routing a freshly submitted enrollment into a review hold
// is only done when this flag is explicitly enabled. Defaults OFF — when off, the
// enrollment stays 'submitted' and admins triage it manually via EnrollmentActions
// (the safe, unchanged default). When ON, enrollment-submit approval rules are
// evaluated and a match parks the enrollment in 'pending_review' for review
// (the status added by supabase/drafts/202606240001_enrollment_review_states.sql).
const ENROLLMENT_APPROVAL_ENABLED = process.env.ENROLLMENT_APPROVAL_ENABLED === 'true';

// STATE-TOUCHING: enforcing DB-driven eligibility (product_eligibility_rules) at
// submit is only done when this flag is explicitly enabled. Defaults OFF — when
// off, eligibility findings are advisory only (surfaced in the wizard's
// plan-selection step) and NEVER affect the submitted enrollment, so in-flight
// enrollments are never halted. When ON, a BLOCKING eligibility finding parks the
// just-submitted enrollment in 'pending_review' for manual triage instead of
// auto-activating it — the same safe, non-fatal mechanism as the approval block.
// (Co-requisite for the 'pending_review' status: the same review-states migration
// the approval block depends on.) Never hard-fails a public submit.
const ELIGIBILITY_ENFORCE = process.env.ELIGIBILITY_ENFORCE === 'true';

/** Whole-year age as of a reference date, from a YYYY-MM-DD (or ISO) DOB string. */
function ageFromDob(dob: string | null | undefined, asOf: Date): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) age--;
  if (age < 0 || age > 120) return null;
  return age;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SubmitBody {
  recaptchaToken?: string;
  member: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    date_of_birth?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  selected_plan_id?: string;
  effective_date?: string;
  household?: Array<{
    first_name: string;
    last_name: string;
    date_of_birth: string;
    relationship: string;
  }>;
  acknowledgments?: Record<string, boolean>;
}

/**
 * POST /api/enroll/submit
 * Final submission for the public enrollment wizard.
 *
 * Validates: signed draft cookie, reCAPTCHA v3 token, required fields.
 * Creates: member, enrollment (status='submitted'), enrollment_dependents.
 * Returns: enrollment id + redirect path.
 */
export async function POST(request: NextRequest) {
  const draft = readDraftFromRequest(request);
  if (!draft) {
    return NextResponse.json({ error: 'no_active_draft' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as SubmitBody;

  const captcha = await verifyRecaptchaToken(body.recaptchaToken, 'enrollment_submit');
  if (!captcha.success) {
    return NextResponse.json(
      { error: 'recaptcha_failed', score: captcha.score, codes: captcha.errorCodes },
      { status: 400 },
    );
  }

  const { member, selected_plan_id, effective_date, household, acknowledgments } = body;
  if (!member?.first_name || !member?.last_name || !member?.email) {
    return NextResponse.json({ error: 'missing_member_fields' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const orgId = draft.organizationId;

  // 1. Find-or-create member (C2: dedup by org + email + NAME so a double-submit / retry
  //    reuses the existing member. NOTE: email alone is NOT unique for members — in
  //    health-benefits, family members legitimately share one email — so we match on
  //    (email, first_name, last_name) to avoid mis-attaching a relative's enrollment.)
  const normalizedEmail = member.email.toLowerCase().trim();
  let memberId: string;

  const { data: emailMatches } = await supabase
    .from('members')
    .select('id, first_name, last_name, merged_into_id')
    .eq('organization_id', orgId)
    .eq('email', normalizedEmail)
    .is('merged_into_id', null)
    .order('id', { ascending: true })
    .limit(200);

  const existingMember = pickActiveMemberByName(
    emailMatches ?? [],
    member.first_name,
    member.last_name,
  );

  if (existingMember) {
    memberId = existingMember.id;
  } else {
    const memberNumber = `M-${Date.now().toString(36).toUpperCase()}`;
    const { data: memberRow, error: memberErr } = await supabase
      .from('members')
      .insert({
        organization_id: orgId,
        member_number: memberNumber,
        first_name: member.first_name,
        last_name: member.last_name,
        email: normalizedEmail,
        phone: member.phone ?? null,
        date_of_birth: member.date_of_birth ?? null,
        address_line1: member.address_line1 ?? null,
        city: member.city ?? null,
        state: member.state ?? null,
        postal_code: member.zip_code ?? null,
        status: 'pending',
        source: 'public_wizard',
      })
      .select('id')
      .single();

    if (memberErr || !memberRow) {
      // A concurrent submit, or a returning member whose row fell outside the lookup
      // window above (>200 members on one email), can collide with
      // members_org_email_name_active_uniq. Rather than 500 a legitimate returning
      // member, recover by reusing the existing active member.
      if (memberErr?.code === '23505') {
        const { data: retryMatches } = await supabase
          .from('members')
          .select('id, first_name, last_name, merged_into_id')
          .eq('organization_id', orgId)
          .eq('email', normalizedEmail)
          .is('merged_into_id', null)
          .order('id', { ascending: true })
          .limit(1000);
        const recovered = pickActiveMemberByName(
          retryMatches ?? [],
          member.first_name,
          member.last_name,
        );
        if (!recovered) {
          return NextResponse.json(
            { error: 'member_create_failed', message: memberErr.message },
            { status: 500 },
          );
        }
        memberId = recovered.id;
      } else {
        return NextResponse.json(
          { error: 'member_create_failed', message: memberErr?.message },
          { status: 500 },
        );
      }
    } else {
      memberId = memberRow.id;
    }
  }

  // 3. Create enrollment via the atomic RPC
  const defaultEffective = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const coverageStart = effective_date ?? defaultEffective;

  // 2. Compute the price SERVER-SIDE (server is the pricing authority).
  //
  // Default: plans.monthly_share — the historical fallback that this public path
  // must NEVER hard-fail on. We only override it with the E123 rate engine when
  // (a) the flag is enabled, (b) the plan has a code + a DB rate set, and (c) the
  // engine returns a clean quote (no NO_AGE_BAND / missing-rate / validation
  // errors). If anything is missing we silently keep monthly_share.
  let basePrice = 0;
  let planCode: string | null = null;
  // Engine-derived line items to persist alongside base_monthly_cost (only set
  // when the engine produced an authoritative quote).
  let engineTobaccoSurcharge: number | null = null;
  let engineSetupFee: number | null = null;
  let engineTotalMonthly: number | null = null;

  if (selected_plan_id) {
    const { data: plan } = await supabase
      .from('plans')
      .select('code, monthly_share')
      .eq('id', selected_plan_id)
      .single();
    basePrice = Number(plan?.monthly_share ?? 0);
    planCode = plan?.code ?? null;
  }

  // Derive household shape from the submitted members (ages by DOB + coverage tier).
  const asOf = new Date(coverageStart);
  const memberAge = ageFromDob(member.date_of_birth, asOf);
  const spouseAges: number[] = [];
  const dependentAges: number[] = [];
  for (const h of household ?? []) {
    const rel = (h.relationship || '').toLowerCase();
    const a = ageFromDob(h.date_of_birth, asOf);
    if (a === null) continue;
    if (rel === 'spouse' || rel === 'partner' || rel === 'husband' || rel === 'wife') {
      spouseAges.push(a);
    } else {
      dependentAges.push(a);
    }
  }
  const hasSpouse = spouseAges.length > 0;
  const hasDependents = dependentAges.length > 0;
  const coverageTier: CoverageTier =
    hasSpouse && hasDependents
      ? 'family'
      : hasSpouse
        ? 'member_spouse'
        : hasDependents
          ? 'member_children'
          : 'member';

  // Only attempt the engine when allowed to persist its price; otherwise we'd
  // compute a number we never write, which would diverge from what's billed.
  if (RATE_ENGINE_WRITE_ENABLED && selected_plan_id && planCode && memberAge !== null) {
    try {
      // Cast mirrors apps/admin/api/rates/config: the rate-table relations and
      // the embedded-join filter aren't in the generated Database types.
      const { data: rateSetRows } = await (supabase as any)
        .from('plan_rate_sets')
        .select(`
          *,
          plan:plans!inner(id, name, code, organization_id),
          entries:plan_rate_entries(*),
          fees:plan_fees(*)
        `)
        .eq('plan.organization_id', orgId)
        .eq('plan_id', selected_plan_id);

      if (rateSetRows && rateSetRows.length > 0) {
        const config = buildRateConfigFromDb(rateSetRows);
        const quoteInput: QuoteInput = {
          planId: planCode,
          coverageTier,
          household: {
            memberAge,
            ...(hasSpouse ? { spouseAge: spouseAges[0] } : {}),
            ...(hasDependents ? { dependentAges } : {}),
          },
          coverageStart,
        };
        const result = quote(config, quoteInput);
        // Server is the authority: only trust a clean, error-free quote. Any
        // NO_AGE_BAND / missing-rate / household-validation error => keep
        // monthly_share so the public path never persists a $0 / partial price.
        if ((!result.errors || result.errors.length === 0) && result.totalMonthly > 0) {
          basePrice = result.monthlyPremium;
          engineTotalMonthly = result.totalMonthly;
          engineSetupFee = result.oneTimeFees.reduce((s, f) => s + f.amount, 0);
          engineTobaccoSurcharge = result.breakdown
            .filter((b) => b.label.toLowerCase().includes('tobacco'))
            .reduce((s, b) => s + b.amount, 0);
        }
      }
    } catch {
      // Engine/DB hiccup must never block a public enrollment — fall back to
      // the monthly_share already loaded above.
    }
  }

  const { data: enrollResult, error: enrollErr } = await supabase.rpc('create_enrollment_tx', {
    p_org_id: orgId,
    p_payload: {
      primary_member_id: memberId,
      selected_plan_id: selected_plan_id ?? null,
      effective_date: effective_date ?? defaultEffective,
      household_size: 1 + (household?.length ?? 0),
      base_monthly_cost: basePrice,
      permanent_bill_day: 20,
      enrollment_source: 'public_wizard',
      channel: 'web',
      // C1: stable per-submit key so a retry/double-click of this wizard draft
      // returns the same enrollment instead of creating a duplicate.
      idempotency_key: `enroll_${draft.draftId}`,
      custom_fields: {
        landing_slug: draft.slug,
        draft_id: draft.draftId,
        recaptcha_score: captcha.score,
        acknowledgments: acknowledgments ?? {},
      },
      dependents: [],
    },
  });

  if (enrollErr || !enrollResult) {
    return NextResponse.json(
      { error: 'enrollment_create_failed', message: enrollErr?.message },
      { status: 500 },
    );
  }

  const enrollmentId = (enrollResult as unknown as { enrollment_id: string }).enrollment_id;
  const idempotentReplay =
    (enrollResult as unknown as { idempotent_replay?: boolean }).idempotent_replay === true;

  // A retry / double-click of the same wizard draft replays the existing enrollment
  // (create_enrollment_tx returns it unchanged). Don't re-run the status transition —
  // which would overwrite submitted_at with a fresh timestamp — or append a duplicate
  // 'submitted' row to enrollment_audit_log (which has no uniqueness guard).
  if (idempotentReplay) {
    const replayResponse = NextResponse.json({
      enrollment_id: enrollmentId,
      redirect: `/enroll/${draft.slug}/done?id=${enrollmentId}`,
    });
    clearDraftCookie(replayResponse);
    return replayResponse;
  }

  // 4. Move enrollment to 'submitted' so admins see it in the queue.
  //    When the rate engine produced an authoritative quote above, persist its
  //    derived line items in the same write. base_monthly_cost was already set
  //    by create_enrollment_tx; here we record the matching surcharge/fee/total
  //    so the admin queue shows the same numbers the engine quoted. (Still the
  //    same brand-new draft enrollment — no active billing schedule to sync.)
  const enrollmentUpdate: Record<string, unknown> = {
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  };
  if (RATE_ENGINE_WRITE_ENABLED && engineTotalMonthly !== null) {
    enrollmentUpdate.tobacco_surcharge = engineTobaccoSurcharge ?? 0;
    enrollmentUpdate.setup_fee = engineSetupFee ?? 0;
    enrollmentUpdate.total_monthly_cost = engineTotalMonthly;
  }
  await supabase
    .from('enrollments')
    .update(enrollmentUpdate)
    .eq('id', enrollmentId);

  // 5. Audit log
  await supabase.from('enrollment_audit_log').insert({
    organization_id: orgId,
    enrollment_id: enrollmentId,
    event_type: 'submitted',
    message: `Public enrollment wizard submission (slug=${draft.slug}, recaptcha=${captcha.score})`,
    data_after: {
      slug: draft.slug,
      draft_id: draft.draftId,
      recaptcha_score: captcha.score,
    },
  });

  // 6. OPTIONAL approval routing (flag-gated; default OFF).
  //    When ENROLLMENT_APPROVAL_ENABLED is on, evaluate the EXISTING approval
  //    rules engine (via the shared @crm-eco/lib/rules operators) against the
  //    just-submitted enrollment. A matching rule routes the enrollment to
  //    'pending_review' instead of leaving it 'submitted'.
  //
  //    CO-REQUISITE: the 'pending_review' status value + pending_review_at column
  //    are introduced by supabase/drafts/202606240001_enrollment_review_states.sql.
  //    Until that migration is applied, 'pending_review' is NOT in
  //    enrollments_status_check and this UPDATE would be rejected — which is why
  //    the whole block is flag-gated OFF by default and wrapped in a non-fatal
  //    try/catch. (Once applied, the BEFORE UPDATE trigger stamps pending_review_at
  //    on the submitted->pending_review transition and leaves submitted_at intact,
  //    so we set status only and let the trigger own the timestamp.)
  //
  //    Entirely non-fatal: any error here leaves the enrollment 'submitted' (the
  //    safe default) and never fails the public submit.
  if (ENROLLMENT_APPROVAL_ENABLED) {
    try {
      const approvalRecord = buildEnrollmentApprovalRecord({
        selectedPlanId: selected_plan_id ?? null,
        effectiveDate: coverageStart,
        state: member.state ?? null,
        householdSize: 1 + (household?.length ?? 0),
        memberAge,
        hasSpouse,
        hasDependents,
        coverageTier,
        baseMonthlyCost: basePrice,
        totalMonthlyCost: engineTotalMonthly,
        acknowledgments,
      });

      const match = await checkEnrollmentApprovalRequired(supabase, orgId, approvalRecord);

      if (match) {
        const reviewReason = `Auto-routed for review by approval rule "${match.ruleName}"`;
        const { error: reviewErr } = await supabase
          .from('enrollments')
          .update({
            status: 'pending_review',
            status_reason: reviewReason,
          })
          .eq('id', enrollmentId)
          .eq('status', 'submitted'); // don't clobber a state an admin already changed

        if (!reviewErr) {
          await supabase.from('enrollment_audit_log').insert({
            organization_id: orgId,
            enrollment_id: enrollmentId,
            event_type: 'status_change',
            old_status: 'submitted',
            new_status: 'pending_review',
            message: reviewReason,
            data_after: {
              approval_rule_id: match.ruleId,
              approval_rule_name: match.ruleName,
              approval_process_id: match.processId,
            },
          });

          // D-submit-record: create the PARALLEL-BINDING approval row that binds
          // to enrollments(id) (NOT crm_approvals/crm_records). Uses the same
          // service-role client already in scope (bypasses RLS for this write).
          //
          // CO-REQUISITE: the enrollment_approvals table is introduced by the
          // additive draft supabase/drafts/202606240005_enrollment_approvals_
          // parallel_binding.sql. Until applied, this insert is rejected — which is
          // harmless because the whole block is flag-gated OFF by default and is
          // wrapped in the non-fatal try/catch below.
          //
          // Idempotent-safe via TWO partial UNIQUE indexes in that draft:
          //   * (enrollment_id) WHERE status='pending'  — at most one OPEN approval
          //     per enrollment (a re-review cycle after the prior row resolved away
          //     from 'pending' can still open a fresh row), and
          //   * (idempotency_key) WHERE idempotency_key IS NOT NULL — mirrors
          //     crm_approvals so a retried request that somehow re-enters this block
          //     cannot double-insert.
          // A unique violation here is the EXPECTED no-op outcome and is swallowed
          // by this try/catch; the submit route also short-circuits idempotent
          // replays earlier, so a second open row is doubly prevented. Failure here
          // is non-fatal and never breaks the public submit; the audit log above
          // already recorded the routing.
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- draft-only table
            await (supabase as any).from('enrollment_approvals').insert({
              org_id: orgId,
              enrollment_id: enrollmentId,
              rule_id: match.ruleId,
              process_id: match.processId,
              status: 'pending',
              requested_by: null, // public/anon submit — no authenticated requester
              idempotency_key: `enroll_approval_${enrollmentId}`,
              context: {
                rule_name: match.ruleName,
                slug: draft.slug,
                draft_id: draft.draftId,
              },
            });
          } catch {
            // A parallel-binding approval-row failure (incl. the expected unique
            // violation on a retried submit) must never break the public submit.
            // The enrollment is already parked in 'pending_review' and the routing
            // is audit-logged; an admin can still triage it manually.
          }
        }
      }
    } catch {
      // Gating must never break a public enrollment — leave it 'submitted'.
    }
  }

  // 7. OPTIONAL eligibility enforcement (flag-gated; default OFF).
  //    When ELIGIBILITY_ENFORCE is on, evaluate the DB-driven
  //    product_eligibility_rules for the selected plan (keyed on
  //    selected_plan_id -> plans) against the household derived above. A BLOCKING
  //    finding parks the enrollment in 'pending_review' for manual triage rather
  //    than auto-activating an ineligible enrollment.
  //
  //    DEFAULT (flag OFF): this entire block is skipped, so eligibility never
  //    affects the submitted enrollment — findings remain advisory in the wizard
  //    UI only, and in-flight enrollments are NEVER halted. With NO rules
  //    configured, checkEligibility returns isEligible:true, so even with the
  //    flag ON the behaviour is unchanged until rules exist.
  //
  //    Entirely non-fatal: any error leaves the enrollment in its current state
  //    (the safe default) and never fails the public submit. Uses the
  //    service-role client (bypasses RLS) like the approval adapter.
  if (ELIGIBILITY_ENFORCE && selected_plan_id) {
    try {
      const eligibility = await checkEligibility(supabase, selected_plan_id, {
        memberAge,
        state: member.state ?? null,
        householdSize: 1 + (household?.length ?? 0),
        coverageStart,
      });

      if (!eligibility.isEligible && eligibility.blocking.length > 0) {
        const first = eligibility.blocking[0];
        const reviewReason = `Held for review by eligibility rule "${first.rule_name}": ${first.message}`;
        const { error: reviewErr } = await supabase
          .from('enrollments')
          .update({
            status: 'pending_review',
            status_reason: reviewReason,
          })
          .eq('id', enrollmentId)
          // Don't clobber a state already changed (e.g. approval routing above,
          // or an admin action). Only escalate a still-'submitted' enrollment.
          .eq('status', 'submitted');

        if (!reviewErr) {
          await supabase.from('enrollment_audit_log').insert({
            organization_id: orgId,
            enrollment_id: enrollmentId,
            event_type: 'status_change',
            old_status: 'submitted',
            new_status: 'pending_review',
            message: reviewReason,
            data_after: {
              eligibility_blocking: eligibility.blocking.map((f) => ({
                rule_id: f.rule_id,
                rule_name: f.rule_name,
                rule_type: f.rule_type,
                message: f.message,
              })),
            },
          });
        }
      }
    } catch {
      // Eligibility gating must never break a public enrollment — leave it as-is.
    }
  }

  const response = NextResponse.json({
    enrollment_id: enrollmentId,
    redirect: `/enroll/${draft.slug}/done?id=${enrollmentId}`,
  });
  clearDraftCookie(response);
  return response;
}
