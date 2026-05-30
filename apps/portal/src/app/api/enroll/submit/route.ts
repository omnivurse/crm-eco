import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { readDraftFromRequest, clearDraftCookie } from '@/lib/enroll/draft-cookie';
import { verifyRecaptchaToken } from '@/lib/enroll/recaptcha';

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

  // 1. Find-or-create member (C2: dedup by org + normalized email so a double-submit /
  //    retry reuses the existing member instead of creating a duplicate).
  const normalizedEmail = member.email.toLowerCase().trim();
  let memberId: string;

  const { data: existingMember } = await supabase
    .from('members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

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
      return NextResponse.json(
        { error: 'member_create_failed', message: memberErr?.message },
        { status: 500 },
      );
    }
    memberId = memberRow.id;
  }

  // 2. Get plan price
  let basePrice = 0;
  if (selected_plan_id) {
    const { data: plan } = await supabase
      .from('plans')
      .select('monthly_share')
      .eq('id', selected_plan_id)
      .single();
    basePrice = Number(plan?.monthly_share ?? 0);
  }

  // 3. Create enrollment via the atomic RPC
  const defaultEffective = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

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

  // 4. Move enrollment to 'submitted' so admins see it in the queue
  await supabase
    .from('enrollments')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
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

  const response = NextResponse.json({
    enrollment_id: enrollmentId,
    redirect: `/enroll/${draft.slug}/done?id=${enrollmentId}`,
  });
  clearDraftCookie(response);
  return response;
}
