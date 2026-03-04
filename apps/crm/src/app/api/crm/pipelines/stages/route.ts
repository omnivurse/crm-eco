import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/pipelines/stages?pipeline_id=<uuid>
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pipelineId = request.nextUrl.searchParams.get('pipeline_id');
    if (!pipelineId) {
      return NextResponse.json({ error: 'Missing pipeline_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .eq('organization_id', profile.organization_id)
      .order('display_order');

    if (error) {
      console.error('[PipelineStages] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 });
    }

    return NextResponse.json({ stages: data || [] });
  } catch (error) {
    console.error('[PipelineStages] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/pipelines/stages — create a stage
// ---------------------------------------------------------------------------
const createStageSchema = z.object({
  pipeline_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  color: z.string().max(20).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
  display_order: z.number().int().optional(),
  required_fields: z.array(z.string()).optional(),
  allowed_from: z.array(z.string().uuid()).optional().nullable(),
  allowed_to: z.array(z.string().uuid()).optional().nullable(),
  auto_actions: z.array(z.unknown()).optional(),
  sla_hours: z.number().int().optional().nullable(),
  rotting_days: z.number().int().optional().nullable(),
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
    const parsed = createStageSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Verify pipeline belongs to this org
    const { data: pipeline } = await supabase
      .from('crm_pipelines')
      .select('id')
      .eq('id', parsed.data.pipeline_id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Auto-set display_order if not provided
    let displayOrder = parsed.data.display_order;
    if (displayOrder === undefined) {
      const { data: maxStage } = await supabase
        .from('crm_pipeline_stages')
        .select('display_order')
        .eq('pipeline_id', parsed.data.pipeline_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();
      displayOrder = (maxStage?.display_order ?? 0) + 1;
    }

    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .insert({
        ...parsed.data,
        organization_id: profile.organization_id,
        display_order: displayOrder,
        required_fields: parsed.data.required_fields || [],
        auto_actions: parsed.data.auto_actions || [],
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Stage with this key already exists in this pipeline' }, { status: 409 });
      }
      console.error('[PipelineStages] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 });
    }

    return NextResponse.json({ stage: data }, { status: 201 });
  } catch (error) {
    console.error('[PipelineStages] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/pipelines/stages — update a stage
// ---------------------------------------------------------------------------
const updateStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  color: z.string().max(20).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  required_fields: z.array(z.string()).optional(),
  allowed_from: z.array(z.string().uuid()).optional().nullable(),
  allowed_to: z.array(z.string().uuid()).optional().nullable(),
  auto_actions: z.array(z.unknown()).optional(),
  sla_hours: z.number().int().optional().nullable(),
  rotting_days: z.number().int().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
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
    const parsed = updateStageSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[PipelineStages] Update error:', error);
      return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 });
    }

    return NextResponse.json({ stage: data });
  } catch (error) {
    console.error('[PipelineStages] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/pipelines/stages?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing stage id' }, { status: 400 });

    // Soft-delete: mark as inactive instead of hard delete
    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[PipelineStages] Delete error:', error);
      return NextResponse.json({ error: 'Failed to deactivate stage' }, { status: 500 });
    }

    return NextResponse.json({ stage: data });
  } catch (error) {
    console.error('[PipelineStages] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/crm/pipelines/stages — bulk reorder stages
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const body = await request.json();
    const schema = z.object({
      stages: z.array(z.object({
        id: z.string().uuid(),
        display_order: z.number().int(),
      })),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Update each stage's display_order
    const updates = parsed.data.stages.map((s) =>
      supabase
        .from('crm_pipeline_stages')
        .update({ display_order: s.display_order })
        .eq('id', s.id)
        .eq('organization_id', profile.organization_id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PipelineStages] Reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
