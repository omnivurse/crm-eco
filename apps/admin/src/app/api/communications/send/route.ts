import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createEmailService } from '@crm-eco/lib/email';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile and verify role
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string; role: string } | null };

    if (!profile || !['owner', 'admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      to,
      toName,
      recipientType,
      recipientId,
      templateId,
      templateSlug,
      subject,
      html,
      text,
      variables = {},
    } = body;

    if (!to) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    // Create email service
    const emailService = createEmailService(supabase as any, profile.organization_id);

    // Send email
    const result = await emailService.sendEmail({
      to,
      toName,
      recipientType,
      recipientId,
      templateId,
      templateSlug,
      subject,
      html,
      text,
      variables,
      triggeredBy: 'manual',
      triggeredByProfileId: profile.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Log activity
    await (supabase as any).rpc('log_admin_activity', {
      p_actor_profile_id: profile.id,
      p_entity_type: 'email',
      p_entity_id: result.sentEmailId || null,
      p_action: 'send',
      p_metadata: { to, subject: subject || templateSlug },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      emailId: result.id,
      sentEmailId: result.sentEmailId,
    });
  } catch (error) {
    console.error('Email send API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
