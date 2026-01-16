import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { dispatchMessage } from '@/lib/comms';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Get user profile and verify CRM access
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden: CRM agent role required' }, { status: 403 });
    }

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
