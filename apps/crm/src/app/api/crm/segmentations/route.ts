import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SEGMENT_TYPES = ['dynamic', 'static', 'smart'] as const;

// ---------------------------------------------------------------------------
// GET /api/crm/segmentations?module_id=<uuid>&type=dynamic&active_only=true
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const moduleId = request.nextUrl.searchParams.get('module_id');
    const type = request.nextUrl.searchParams.get('type');
    const activeOnly = request.nextUrl.searchParams.get('active_only') === 'true';
    const includeMembers = request.nextUrl.searchParams.get('include_members') === 'true';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    const selectClause = includeMembers
      ? '*, members:crm_segment_members(id, record_id, added_by, added_at)'
      : '*';

    let query = supabase
      .from('crm_segmentations')
      .select(selectClause, { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('name')
      .range(offset, offset + limit - 1);

    if (moduleId) query = query.eq('module_id', moduleId);
    if (type) query = query.eq('segment_type', type);
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error, count } = await query;
    if (error) {
      // Table missing (42P01), generic "does not exist", or PostgREST schema
      // cache miss (PGRST205) — degrade to empty rather than 500ing the page.
      const code = (error as { code?: string }).code;
      if (
        code === '42P01' ||
        code === 'PGRST205' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache')
      ) {
        console.warn('[Segmentations] Table/cache unavailable, returning empty:', code, error.message);
        return NextResponse.json({ segments: [], total: 0 });
      }
      console.error('[Segmentations] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
    }

    return NextResponse.json({ segments: data || [], total: count || 0 });
  } catch (error) {
    console.error('[Segmentations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/segmentations — create a segment
// ---------------------------------------------------------------------------
const createSegmentSchema = z.object({
  module_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  description: z.string().max(1000).optional().nullable(),
  segment_type: z.enum(SEGMENT_TYPES).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  criteria: z.record(z.unknown()).optional(),
  required_signals: z.array(z.string()).optional(),
  excluded_signals: z.array(z.string()).optional(),
  min_score: z.number().int().optional().nullable(),
  max_score: z.number().int().optional().nullable(),
  score_field: z.string().max(200).optional(),
  compute_interval_hours: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
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
    const parsed = createSegmentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { data, error } = await supabase
      .from('crm_segmentations')
      .insert({
        organization_id: profile.organization_id,
        ...parsed.data,
        criteria: parsed.data.criteria || {},
        required_signals: parsed.data.required_signals || [],
        excluded_signals: parsed.data.excluded_signals || [],
        tags: parsed.data.tags || [],
        config: parsed.data.config || {},
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Segment with this key already exists' }, { status: 409 });
      }
      console.error('[Segmentations] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 });
    }

    return NextResponse.json({ segment: data }, { status: 201 });
  } catch (error) {
    console.error('[Segmentations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/segmentations — update a segment
// ---------------------------------------------------------------------------
const updateSegmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  criteria: z.record(z.unknown()).optional(),
  required_signals: z.array(z.string()).optional(),
  excluded_signals: z.array(z.string()).optional(),
  min_score: z.number().int().optional().nullable(),
  max_score: z.number().int().optional().nullable(),
  score_field: z.string().max(200).optional(),
  compute_interval_hours: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
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
    const parsed = updateSegmentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_segmentations')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[Segmentations] Update error:', error);
      return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 });
    }

    return NextResponse.json({ segment: data });
  } catch (error) {
    console.error('[Segmentations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/crm/segmentations — recompute segment membership
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
    const schema = z.object({ id: z.string().uuid() });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Verify segment belongs to this org
    const { data: segment } = await supabase
      .from('crm_segmentations')
      .select('id')
      .eq('id', parsed.data.id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const { data, error } = await supabase.rpc('fn_compute_segment_membership', {
      p_segment_id: parsed.data.id,
    });

    if (error) {
      console.error('[Segmentations] Compute error:', error);
      return NextResponse.json({ error: 'Failed to recompute membership' }, { status: 500 });
    }

    return NextResponse.json({ member_count: data });
  } catch (error) {
    console.error('[Segmentations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/segmentations?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing segment id' }, { status: 400 });

    // Prevent deleting system segments
    const { data: segment } = await supabase
      .from('crm_segmentations')
      .select('is_system')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (segment?.is_system) {
      return NextResponse.json({ error: 'Cannot delete system segments' }, { status: 403 });
    }

    const { error } = await supabase
      .from('crm_segmentations')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[Segmentations] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Segmentations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
