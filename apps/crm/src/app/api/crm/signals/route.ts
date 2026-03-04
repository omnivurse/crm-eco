import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SIGNAL_CATEGORIES = [
  'engagement', 'risk', 'opportunity', 'compliance',
  'lifecycle', 'health', 'activity', 'custom',
] as const;

const SIGNAL_SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;

const SIGNAL_TRIGGER_TYPES = [
  'condition', 'threshold', 'inactivity', 'scheduled', 'manual',
] as const;

// ---------------------------------------------------------------------------
// GET /api/crm/signals?category=risk&module_id=<uuid>&enabled_only=true
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const category = request.nextUrl.searchParams.get('category');
    const moduleId = request.nextUrl.searchParams.get('module_id');
    const enabledOnly = request.nextUrl.searchParams.get('enabled_only') === 'true';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('crm_signals')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('category')
      .order('name')
      .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (moduleId) query = query.eq('module_id', moduleId);
    if (enabledOnly) query = query.eq('is_enabled', true);

    const { data, error, count } = await query;
    if (error) {
      console.error('[Signals] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
    }

    return NextResponse.json({ signals: data || [], total: count || 0 });
  } catch (error) {
    console.error('[Signals] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/signals — create a signal definition
// ---------------------------------------------------------------------------
const createSignalSchema = z.object({
  module_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  description: z.string().max(1000).optional().nullable(),
  category: z.enum(SIGNAL_CATEGORIES).optional(),
  severity: z.enum(SIGNAL_SEVERITIES).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  trigger_type: z.enum(SIGNAL_TRIGGER_TYPES).optional(),
  conditions: z.array(z.unknown()).optional(),
  threshold_field: z.string().max(200).optional().nullable(),
  threshold_op: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'between']).optional().nullable(),
  threshold_value: z.unknown().optional().nullable(),
  inactivity_days: z.number().int().min(1).optional().nullable(),
  inactivity_field: z.string().max(200).optional().nullable(),
  cron_expression: z.string().max(100).optional().nullable(),
  auto_resolve: z.boolean().optional(),
  resolve_after_days: z.number().int().min(1).optional().nullable(),
  on_fire_actions: z.array(z.unknown()).optional(),
  on_resolve_actions: z.array(z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSignalSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { data, error } = await supabase
      .from('crm_signals')
      .insert({
        organization_id: profile.organization_id,
        ...parsed.data,
        conditions: parsed.data.conditions || [],
        on_fire_actions: parsed.data.on_fire_actions || [],
        on_resolve_actions: parsed.data.on_resolve_actions || [],
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Signal with this key already exists' }, { status: 409 });
      }
      console.error('[Signals] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 });
    }

    return NextResponse.json({ signal: data }, { status: 201 });
  } catch (error) {
    console.error('[Signals] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/signals — update a signal definition
// ---------------------------------------------------------------------------
const updateSignalSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.enum(SIGNAL_CATEGORIES).optional(),
  severity: z.enum(SIGNAL_SEVERITIES).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  trigger_type: z.enum(SIGNAL_TRIGGER_TYPES).optional(),
  conditions: z.array(z.unknown()).optional(),
  threshold_field: z.string().max(200).optional().nullable(),
  threshold_op: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'between']).optional().nullable(),
  threshold_value: z.unknown().optional().nullable(),
  inactivity_days: z.number().int().min(1).optional().nullable(),
  inactivity_field: z.string().max(200).optional().nullable(),
  cron_expression: z.string().max(100).optional().nullable(),
  auto_resolve: z.boolean().optional(),
  resolve_after_days: z.number().int().min(1).optional().nullable(),
  on_fire_actions: z.array(z.unknown()).optional(),
  on_resolve_actions: z.array(z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSignalSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_signals')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[Signals] Update error:', error);
      return NextResponse.json({ error: 'Failed to update signal' }, { status: 500 });
    }

    return NextResponse.json({ signal: data });
  } catch (error) {
    console.error('[Signals] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/signals?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing signal id' }, { status: 400 });

    // Prevent deleting system signals
    const { data: signal } = await supabase
      .from('crm_signals')
      .select('is_system')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (signal?.is_system) {
      return NextResponse.json({ error: 'Cannot delete system signals' }, { status: 403 });
    }

    const { error } = await supabase
      .from('crm_signals')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[Signals] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete signal' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Signals] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
