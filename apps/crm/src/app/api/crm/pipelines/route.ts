import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PIPELINE_TYPES = ['standard', 'lead', 'enrollment', 'support', 'custom'] as const;

// ---------------------------------------------------------------------------
// GET /api/crm/pipelines?type=lead&include_stages=true
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pipelineType = request.nextUrl.searchParams.get('type');
    const includeStages = request.nextUrl.searchParams.get('include_stages') === 'true';

    let query = supabase
      .from('crm_pipelines')
      .select(includeStages
        ? '*, crm_pipeline_stages(*)'
        : '*')
      .eq('organization_id', profile.organization_id)
      .order('display_order');

    if (pipelineType) query = query.eq('pipeline_type', pipelineType);

    const { data, error } = await query;
    if (error) {
      console.error('[Pipelines] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch pipelines' }, { status: 500 });
    }

    return NextResponse.json({ pipelines: data || [] });
  } catch (error) {
    console.error('[Pipelines] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/pipelines — create a pipeline
// ---------------------------------------------------------------------------
const createPipelineSchema = z.object({
  name: z.string().min(1).max(200),
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  description: z.string().max(500).optional(),
  pipeline_type: z.enum(PIPELINE_TYPES).optional(),
  module_id: z.string().uuid().optional().nullable(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  config: z.record(z.unknown()).optional(),
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
    const parsed = createPipelineSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { data, error } = await supabase
      .from('crm_pipelines')
      .insert({
        organization_id: profile.organization_id,
        ...parsed.data,
        config: parsed.data.config || {},
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Pipeline with this key already exists' }, { status: 409 });
      }
      console.error('[Pipelines] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create pipeline' }, { status: 500 });
    }

    return NextResponse.json({ pipeline: data }, { status: 201 });
  } catch (error) {
    console.error('[Pipelines] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/pipelines — update a pipeline
// ---------------------------------------------------------------------------
const updatePipelineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  pipeline_type: z.enum(PIPELINE_TYPES).optional(),
  module_id: z.string().uuid().optional().nullable(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  display_order: z.number().int().optional(),
  config: z.record(z.unknown()).optional(),
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
    const parsed = updatePipelineSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_pipelines')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[Pipelines] Update error:', error);
      return NextResponse.json({ error: 'Failed to update pipeline' }, { status: 500 });
    }

    return NextResponse.json({ pipeline: data });
  } catch (error) {
    console.error('[Pipelines] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/pipelines?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing pipeline id' }, { status: 400 });

    // Check if pipeline is default (can't delete default)
    const { data: pipeline } = await supabase
      .from('crm_pipelines')
      .select('is_default')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (pipeline?.is_default) {
      return NextResponse.json({ error: 'Cannot delete the default pipeline' }, { status: 400 });
    }

    const { error } = await supabase
      .from('crm_pipelines')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[Pipelines] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete pipeline' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Pipelines] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
