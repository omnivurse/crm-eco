import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
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
    const firstLc = (data.firstName ?? '').trim().toLowerCase();
    const lastLc = (data.lastName ?? '').trim().toLowerCase();
    const { data: emailMatches } = await supabase
      .from('members')
      .select('id, first_name, last_name')
      .eq('organization_id', landingPage.organization_id)
      .eq('email', emailLc)
      .limit(50);
    const existingMember = (emailMatches ?? []).find(
      (m) => (m.first_name ?? '').trim().toLowerCase() === firstLc && (m.last_name ?? '').trim().toLowerCase() === lastLc,
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
          email: data.email.toLowerCase(),
          phone: data.phone,
          state: data.state,
          status: 'pending',
          advisor_id: landingPage.default_advisor_id,
        })
        .select('id')
        .single();

      if (memberError) {
        return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
      }

      memberId = newMember.id;
    }

    // Create the lead record for tracking
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: landingPage.organization_id,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        state: data.state,
        status: 'new',
        source: 'landing_page',
        source_details: landingPage.utm_campaign || landingPage.utm_source || 'website',
        advisor_id: landingPage.default_advisor_id,
      })
      .select('id')
      .single();

    if (leadError) {
      // Don't fail the request, member was created
    }

    // Create the enrollment record
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        organization_id: landingPage.organization_id,
        primary_member_id: memberId,
        selected_plan_id: data.planId || null,
        advisor_id: landingPage.default_advisor_id,
        status: 'draft',
        enrollment_source: 'landing_page',
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
      .select('id')
      .single();

    if (enrollmentError) {
      return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
    }

    // Track successful enrollment event
    await supabase.from('landing_page_events').insert({
      landing_page_id: landingPage.id,
      organization_id: landingPage.organization_id,
      event_type: 'enrollment_created',
      lead_id: lead?.id,
      enrollment_id: enrollment.id,
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
      enrollmentId: enrollment.id,
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
          enrollmentId: enrollment.id,
          organizationName,
        });

        if (!notificationResult.success) {
          console.warn('Failed to send advisor notification email:', notificationResult.error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment.id,
    });
  } catch (error) {
    console.error('Public enrollment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
