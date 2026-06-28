import { NextRequest, NextResponse } from 'next/server';
import {
  pickActiveMemberByName,
  checkEligibility,
  buildEnrollmentApprovalRecord,
  checkEnrollmentApprovalRequired,
} from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  finalizeEnrollment,
  type PaymentMethodInput,
  type PaymentBillingAddress,
} from '@crm-eco/lib';
import { quote, buildRateConfigFromDb } from '@crm-eco/rates';
import type { CoverageTier, QuoteInput } from '@crm-eco/rates/types';
import {
  readDraftFromRequest,
  clearDraftCookie,
  verifyRecaptchaToken,
} from '@crm-eco/lib/enroll';

// MONEY-TOUCHING: persisting the engine-computed base_monthly_cost is only done
// when this flag is explicitly enabled. Defaults OFF — when off, this path keeps
// its prior behavior and uses plans.monthly_share. (This route only ever creates
// a NEW draft enrollment via create_enrollment_tx, so the billing-cost sync
// trigger is a no-op here; this is not a bulk backfill.)
const RATE_ENGINE_WRITE_ENABLED = process.env.RATE_ENGINE_WRITE_ENABLED === 'true';

// STATE-TOUCHING: auto-routing a freshly submitted enrollment into a review hold
// is only done when this flag is explicitly enabled. Defaults OFF — when off, the
// enrollment stays 'submitted' and admins triage it manually.
const ENROLLMENT_APPROVAL_ENABLED = process.env.ENROLLMENT_APPROVAL_ENABLED === 'true';

// STATE-TOUCHING: enforcing DB-driven eligibility at submit is only done when this
// flag is explicitly enabled. Defaults OFF — findings are advisory only. Never
// hard-fails a public submit.
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

/** Post-submit redirect; guards the generic (no-slug) path so it isn't `/enroll//done`. */
function donePath(slug: string, id: string): string {
  return slug ? `/enroll/${slug}/done?id=${id}` : `/enroll/done?id=${id}`;
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
  /**
   * Payment method collected at the wizard's payment step. When present AND
   * ENROLLMENT_COMPLETION_ENABLED is on, the enrollment is completed immediately
   * (vault + first-month charge + provision). Until the new bank adapter +
   * tokenized payment step ship, this is absent and the flow is unchanged.
   */
  paymentMethod?: PaymentMethodInput;
  billingAddress?: PaymentBillingAddress;
}

/**
 * POST /api/enroll/submit
 * Final submission for the public enrollment wizard (anonymous prospect — NO
 * login, NO pre-existing member required).
 *
 * Identity/ownership = the signed draft cookie (NOT auth). All writes use the
 * service-role client. reCAPTCHA v3 is verified on submit. Org + advisor + source
 * are read from the SIGNED draft (server-trusted), never the client body.
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

  const draftData = draft.data ?? {};
  const advisorId =
    typeof draftData.advisor_id === 'string' && draftData.advisor_id ? draftData.advisor_id : null;
  const landingPageId =
    typeof draftData.landing_page_id === 'string' && draftData.landing_page_id
      ? draftData.landing_page_id
      : null;
  const enrollmentSource =
    typeof draftData.enrollment_source === 'string' && draftData.enrollment_source
      ? draftData.enrollment_source
      : 'website';

  // 1. Find-or-create member (dedup by org + email + NAME so a double-submit reuses
  //    the existing member; email alone is not unique — families share emails).
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
        source: 'website',
        advisor_id: advisorId,
      })
      .select('id')
      .single();

    if (memberErr || !memberRow) {
      // Concurrent submit / returning member outside the lookup window can collide
      // with members_org_email_name_active_uniq — recover instead of 500.
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

  // 2. Compute the price SERVER-SIDE. Default: plans.monthly_share (never hard-fail).
  //    Override with the rate engine only when the flag is on AND a clean quote exists.
  let basePrice = 0;
  let planCode: string | null = null;
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

  if (RATE_ENGINE_WRITE_ENABLED && selected_plan_id && planCode && memberAge !== null) {
    try {
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
      // Engine/DB hiccup must never block a public enrollment — fall back to monthly_share.
    }
  }

  const { data: enrollResult, error: enrollErr } = await supabase.rpc('create_enrollment_tx', {
    p_org_id: orgId,
    p_payload: {
      primary_member_id: memberId,
      advisor_id: advisorId,
      selected_plan_id: selected_plan_id ?? null,
      effective_date: effective_date ?? defaultEffective,
      household_size: 1 + (household?.length ?? 0),
      base_monthly_cost: basePrice,
      permanent_bill_day: 20,
      enrollment_source: enrollmentSource,
      channel: 'web',
      idempotency_key: `enroll_${draft.draftId}`,
      custom_fields: {
        landing_slug: draft.slug,
        landing_page_id: landingPageId,
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

  // Retry / double-click replays the existing enrollment — don't re-run the status
  // transition or append a duplicate audit row.
  if (idempotentReplay) {
    const replayResponse = NextResponse.json({
      enrollment_id: enrollmentId,
      redirect: donePath(draft.slug, enrollmentId),
    });
    clearDraftCookie(replayResponse);
    return replayResponse;
  }

  // 4. Move enrollment to 'submitted' so admins see it in the queue.
  const enrollmentUpdate: Record<string, unknown> = {
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  };
  if (RATE_ENGINE_WRITE_ENABLED && engineTotalMonthly !== null) {
    enrollmentUpdate.tobacco_surcharge = engineTobaccoSurcharge ?? 0;
    enrollmentUpdate.setup_fee = engineSetupFee ?? 0;
    enrollmentUpdate.total_monthly_cost = engineTotalMonthly;
  }
  await supabase.from('enrollments').update(enrollmentUpdate).eq('id', enrollmentId);

  // 5. Audit log
  await supabase.from('enrollment_audit_log').insert({
    organization_id: orgId,
    enrollment_id: enrollmentId,
    event_type: 'submitted',
    message: `Public enrollment submission (slug=${draft.slug || 'generic'}, recaptcha=${captcha.score})`,
    data_after: {
      slug: draft.slug,
      draft_id: draft.draftId,
      landing_page_id: landingPageId,
      advisor_id: advisorId,
      enrollment_source: enrollmentSource,
      recaptcha_score: captcha.score,
    },
  });

  // 6. OPTIONAL approval routing (flag-gated; default OFF). Non-fatal.
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
          .update({ status: 'pending_review', status_reason: reviewReason })
          .eq('id', enrollmentId)
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
              approval_rule_id: match.ruleId,
              approval_rule_name: match.ruleName,
              approval_process_id: match.processId,
            },
          });

          try {
            await (supabase as any).from('enrollment_approvals').insert({
              org_id: orgId,
              enrollment_id: enrollmentId,
              rule_id: match.ruleId,
              process_id: match.processId,
              status: 'pending',
              requested_by: null,
              idempotency_key: `enroll_approval_${enrollmentId}`,
              context: {
                rule_name: match.ruleName,
                slug: draft.slug,
                draft_id: draft.draftId,
              },
            });
          } catch {
            // Expected unique-violation on a retried submit — non-fatal.
          }
        }
      }
    } catch {
      // Gating must never break a public enrollment — leave it 'submitted'.
    }
  }

  // 7. OPTIONAL eligibility enforcement (flag-gated; default OFF). Non-fatal.
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
          .update({ status: 'pending_review', status_reason: reviewReason })
          .eq('id', enrollmentId)
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

  // 6. GATED completion (the gold-standard flow). When a payment method was
  // collected and ENROLLMENT_COMPLETION_ENABLED is on, finalize now: vault +
  // charge month 1 -> membership (effective the 1st) + billing schedule ->
  // portal invite -> member + agent emails. Off by default, so until the new
  // bank adapter + tokenized payment step ship, live behavior is unchanged.
  // Non-fatal: a failure still returns the submitted enrollment for manual
  // finalization in the admin Command Center.
  let completion:
    | { success: boolean; error?: string; placeholderPayment?: boolean }
    | undefined;
  if (
    process.env.ENROLLMENT_COMPLETION_ENABLED === 'true' &&
    body.paymentMethod &&
    selected_plan_id &&
    basePrice > 0
  ) {
    try {
      const [{ data: orgRow }, { data: planRow }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
        supabase.from('plans').select('name').eq('id', selected_plan_id).maybeSingle(),
      ]);
      const result = await finalizeEnrollment(supabase, {
        organizationId: orgId,
        enrollmentId,
        memberId,
        email: normalizedEmail,
        firstName: member.first_name,
        lastName: member.last_name,
        phone: member.phone ?? '',
        amountCents: Math.round(basePrice * 100),
        paymentMethod: body.paymentMethod,
        billingAddress: body.billingAddress,
        planName: planRow?.name ?? undefined,
        organizationName: orgRow?.name ?? 'Pay It Forward Health',
        // Coverage starts on the 1st — let the RPC default to the 1st of next month.
        effectiveDate: null,
        portalRedirectTo: `${process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://members.payitforwardhealth.com'}/update-password`,
      });
      completion = {
        success: result.success,
        error: result.error,
        placeholderPayment: result.placeholderPayment,
      };
    } catch (e) {
      completion = { success: false, error: e instanceof Error ? e.message : 'completion_failed' };
    }
  }

  const response = NextResponse.json({
    enrollment_id: enrollmentId,
    redirect: donePath(draft.slug, enrollmentId),
    ...(completion ? { completion } : {}),
  });
  clearDraftCookie(response);
  return response;
}
