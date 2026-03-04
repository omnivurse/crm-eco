import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const WEBHOOK_EVENTS = [
  'record.created', 'record.updated', 'record.deleted', 'record.stage_changed',
  'contact.created', 'contact.updated', 'contact.deleted',
  'deal.created', 'deal.updated', 'deal.won', 'deal.lost',
  'task.created', 'task.completed',
  'note.created',
  'import.completed', 'export.completed',
  'pipeline.stage_changed',
  'signal.fired', 'signal.resolved',
  'extension.installed', 'extension.uninstalled',
  'api_key.created', 'api_key.revoked',
] as const;

const AUTH_TYPES = ['hmac_sha256', 'basic', 'bearer', 'none'] as const;

// ---------------------------------------------------------------------------
// GET /api/crm/developer/webhooks?status=active
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get('status');

    let query = supabase
      .from('crm_webhooks')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[Webhooks] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
    }

    // Mask secrets in response
    const webhooks = (data || []).map(({ secret, auth_value, ...rest }) => ({
      ...rest,
      secret_masked: secret ? `${secret.slice(0, 6)}${'*'.repeat(20)}` : null,
      has_auth: !!auth_value,
    }));

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error('[Webhooks] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/developer/webhooks — create a webhook subscription
// ---------------------------------------------------------------------------
const createWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  url: z.string().url().max(2000),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  auth_type: z.enum(AUTH_TYPES).optional(),
  auth_value: z.string().max(500).optional().nullable(),
  custom_headers: z.record(z.string()).optional(),
  module_id: z.string().uuid().optional().nullable(),
  filters: z.record(z.unknown()).optional(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
  max_retries: z.number().int().min(0).max(10).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createWebhookSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Generate signing secret
    const secret = `whsec_${randomBytes(24).toString('hex')}`;

    const { data, error } = await supabase
      .from('crm_webhooks')
      .insert({
        organization_id: profile.organization_id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        url: parsed.data.url,
        events: parsed.data.events,
        secret,
        auth_type: parsed.data.auth_type || 'hmac_sha256',
        auth_value: parsed.data.auth_value || null,
        custom_headers: parsed.data.custom_headers || {},
        module_id: parsed.data.module_id || null,
        filters: parsed.data.filters || {},
        timeout_ms: parsed.data.timeout_ms || 10000,
        max_retries: parsed.data.max_retries || 3,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[Webhooks] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
    }

    // Return secret ONLY on creation
    return NextResponse.json({
      webhook: {
        ...data,
        secret,  // Only shown once
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Webhooks] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/developer/webhooks — update a webhook
// ---------------------------------------------------------------------------
const updateWebhookSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  url: z.string().url().max(2000).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  auth_type: z.enum(AUTH_TYPES).optional(),
  auth_value: z.string().max(500).optional().nullable(),
  custom_headers: z.record(z.string()).optional(),
  module_id: z.string().uuid().optional().nullable(),
  filters: z.record(z.unknown()).optional(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
  max_retries: z.number().int().min(0).max(10).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateWebhookSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    // If re-enabling, reset consecutive failures
    const extra: Record<string, unknown> = {};
    if (updates.status === 'active') {
      extra.consecutive_failures = 0;
    }

    const { data, error } = await supabase
      .from('crm_webhooks')
      .update({ ...updates, ...extra })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[Webhooks] Update error:', error);
      return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
    }

    // Mask secret in response
    const { secret, auth_value, ...rest } = data;
    return NextResponse.json({
      webhook: {
        ...rest,
        secret_masked: secret ? `${secret.slice(0, 6)}${'*'.repeat(20)}` : null,
        has_auth: !!auth_value,
      },
    });
  } catch (error) {
    console.error('[Webhooks] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/developer/webhooks?id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing webhook id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_webhooks')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[Webhooks] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhooks] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
