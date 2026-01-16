import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

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

    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('members')
      .select('id')
      .eq('organization_id', landingPage.organization_id)
      .eq('email', data.email.toLowerCase())
      .single();

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
        console.error('Failed to create member:', memberError);
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
      console.error('Failed to create lead:', leadError);
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
      console.error('Failed to create enrollment:', enrollmentError);
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

    // TODO: Send confirmation email
    // TODO: Notify advisor if assigned

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment.id,
    });
  } catch (error) {
    console.error('Public enrollment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
