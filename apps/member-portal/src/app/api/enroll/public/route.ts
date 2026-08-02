import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  pickActiveMemberByName,
  insertCrmLead,
  resolvePendingMemberEffectiveDate,
} from '@crm-eco/lib';
import {
  sendEnrollmentConfirmationEmail,
  sendAdvisorNotificationEmail,
} from '@crm-eco/lib/email';
import { rateLimit, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';

// Use service role for public enrollment
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const enrollmentSchema = z.object({
  landingPageId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  state: z.string().length(2),
  planId: z.string().uuid().optional(),
});

/**
 * POST /api/enroll/public
 * Handle public enrollment form submissions
 */
export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const rateLimitResult = rateLimit(`enroll:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const body = await request.json();
    const parsed = enrollmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const data = parsed.data;
    const supabase = getServiceClient();

    // Get the landing page to find the organization
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('id, organization_id, default_advisor_id, utm_source, utm_campaign')
      .eq('id', data.landingPageId)
      .single();

    if (lpError || !landingPage) {
      return NextResponse.json({ error: 'Invalid landing page' }, { status: 400 });
    }

    // Track the submission event
    await supabase.from('landing_page_events').insert({
      landing_page_id: landingPage.id,
      organization_id: landingPage.organization_id,
      event_type: 'submit',
    });

    // Update landing page stats
    try {
      await supabase.rpc('increment_landing_page_submissions', { 
        page_id: landingPage.id 
      });
    } catch {
      // RPC might not exist, ignore error
    }

    // Check if member already exists. Match on email + NAME, not email alone: family
    // members legitimately share one email in health-benefits, so an email-only match
    // (esp. with .single(), which throws on >1) would mis-attach or error.
    const emailLc = data.email.toLowerCase().trim();
    const { data: emailMatches } = await supabase
      .from('members')
      .select('id, first_name, last_name, merged_into_id')
      .eq('organization_id', landingPage.organization_id)
      .eq('email', emailLc)
      .is('merged_into_id', null)
      .order('id', { ascending: true })
      .limit(200);
    const existingMember = pickActiveMemberByName(
      emailMatches ?? [],
      data.firstName,
      data.lastName,
    );

    let memberId: string;

    if (existingMember) {
      memberId = existingMember.id;
    } else {
      // Create a new member record
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          organization_id: landingPage.organization_id,
          first_name: data.firstName,
          last_name: data.lastName,
          email: emailLc,
          phone: data.phone,
          state: data.state,
          status: 'pending',
          effective_date: resolvePendingMemberEffectiveDate(null),
          advisor_id: landingPage.default_advisor_id,
        })
        .select('id')
        .single();

      if (memberError || !newMember) {
        // A concurrent submit, or a returning member outside the lookup window above,
        // can collide with members_org_email_name_active_uniq. Recover by reusing the
        // existing active member instead of failing the enrollment.
        if (memberError?.code === '23505') {
          const { data: retryMatches } = await supabase
            .from('members')
            .select('id, first_name, last_name, merged_into_id')
            .eq('organization_id', landingPage.organization_id)
            .eq('email', emailLc)
            .is('merged_into_id', null)
            .order('id', { ascending: true })
            .limit(1000);
          const recovered = pickActiveMemberByName(
            retryMatches ?? [],
            data.firstName,
            data.lastName,
          );
          if (!recovered) {
            return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
          }
          memberId = recovered.id;
        } else {
          return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
        }
      } else {
        memberId = newMember.id;
      }
    }

    // Create the lead record for tracking (crm_records / leads module)
    const leadResult = await insertCrmLead(supabase, {
      orgId: landingPage.organization_id,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
      state: data.state,
      status: 'new',
      source: 'landing_page',
      source_details: landingPage.utm_campaign || landingPage.utm_source || 'website',
      advisor_id: landingPage.default_advisor_id,
    });

    const lead = 'id' in leadResult ? leadResult : null;
    if ('error' in leadResult) {
      console.warn('Failed to create CRM lead for landing page enrollment:', leadResult.error);
    }

    // Create the enrollment via the atomic, idempotent RPC so a retry / double-submit of
    // the same landing-page form (same member + plan) reuses the existing enrollment
    // instead of creating a duplicate — a duplicate would later double-bill / double-pay
    // commission once both are approved.
    const idempotencyKey = `landing_${landingPage.id}_${memberId}_${data.planId ?? 'none'}`;
    const { data: enrollResult, error: enrollmentError } = await supabase.rpc('create_enrollment_tx', {
      p_org_id: landingPage.organization_id,
      p_payload: {
        primary_member_id: memberId,
        advisor_id: landingPage.default_advisor_id ?? null,
        selected_plan_id: data.planId ?? null,
        enrollment_source: 'landing_page',
        channel: 'web',
        idempotency_key: idempotencyKey,
        custom_fields: { landing_page_id: landingPage.id },
        dependents: [],
      },
    });

    if (enrollmentError || !enrollResult) {
      return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
    }

    const enrollmentId = (enrollResult as { enrollment_id: string }).enrollment_id;
    const idempotentReplay =
      (enrollResult as { idempotent_replay?: boolean }).idempotent_replay === true;

    // Retry / double-submit: the enrollment already exists. Don't duplicate it, re-fire the
    // confirmation/advisor emails, or re-log the enrollment_created event.
    if (idempotentReplay) {
      return NextResponse.json({ success: true, enrollmentId });
    }

    // create_enrollment_tx doesn't set the wizard snapshot, but the rest of the portal
    // reads enrollment.snapshot.intake — preserve it on first creation.
    await supabase
      .from('enrollments')
      .update({
        snapshot: {
          landing_page_id: landingPage.id,
          intake: {
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            phone: data.phone,
            state: data.state,
          },
        },
      })
      .eq('id', enrollmentId);

    // Track successful enrollment event
    await supabase.from('landing_page_events').insert({
      landing_page_id: landingPage.id,
      organization_id: landingPage.organization_id,
      event_type: 'enrollment_created',
      lead_id: lead?.id,
      enrollment_id: enrollmentId,
    });

    // Get organization info for emails
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', landingPage.organization_id)
      .single();

    const organizationName = org?.name || 'Your Organization';

    // Get plan name if selected
    let planName: string | undefined;
    if (data.planId) {
      const { data: plan } = await supabase
        .from('plans')
        .select('name')
        .eq('id', data.planId)
        .single();
      planName = plan?.name;
    }

    // Send confirmation email to member
    const confirmationResult = await sendEnrollmentConfirmationEmail({
      toEmail: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      planName,
      enrollmentId,
      organizationName,
    });

    if (!confirmationResult.success) {
      console.warn('Failed to send enrollment confirmation email:', confirmationResult.error);
    }

    // Notify advisor if assigned
    if (landingPage.default_advisor_id) {
      const { data: advisor } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', landingPage.default_advisor_id)
        .single();

      if (advisor?.email) {
        const notificationResult = await sendAdvisorNotificationEmail({
          advisorEmail: advisor.email,
          advisorName: advisor.full_name || 'Advisor',
          memberFirstName: data.firstName,
          memberLastName: data.lastName,
          memberEmail: data.email.toLowerCase(),
          memberPhone: data.phone,
          enrollmentId,
          organizationName,
        });

        if (!notificationResult.success) {
          console.warn('Failed to send advisor notification email:', notificationResult.error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      enrollmentId,
    });
  } catch (error) {
    console.error('Public enrollment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
