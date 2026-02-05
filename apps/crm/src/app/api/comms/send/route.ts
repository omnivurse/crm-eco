import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { dispatchMessage } from '@/lib/comms';

const sendMessageSchema = z.object({
  recordId: z.string().uuid(),
  channel: z.enum(['email', 'sms']),
  templateId: z.string().uuid().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  to: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
});

/**
 * POST /api/comms/send
 * Send an email or SMS message
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden: CRM agent role required' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify record belongs to user's org
    const { data: record } = await supabase
      .from('crm_records')
      .select('org_id')
      .eq('id', parsed.data.recordId)
      .single();

    if (!record || record.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Validate template if provided
    if (parsed.data.templateId) {
      const { data: template } = await supabase
        .from('crm_message_templates')
        .select('org_id')
        .eq('id', parsed.data.templateId)
        .single();

      if (!template || template.org_id !== profile.organization_id) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
    }

    // Must have either template or body
    if (!parsed.data.templateId && !parsed.data.body) {
      return NextResponse.json(
        { error: 'Either templateId or body must be provided' },
        { status: 400 }
      );
    }

    // Dispatch message
    const result = await dispatchMessage(parsed.data, profile.id);

    if (result.blocked) {
      return NextResponse.json({
        success: false,
        blocked: true,
        reason: result.blockReason,
      }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        status: result.status,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
