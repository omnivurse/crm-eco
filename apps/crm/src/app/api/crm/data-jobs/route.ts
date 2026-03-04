import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const JOB_TYPES = ['deduplicate', 'merge', 'mass_update', 'mass_delete', 'enrich'] as const;

// ---------------------------------------------------------------------------
// GET /api/crm/data-jobs?type=deduplicate&status=completed&limit=20
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jobType = request.nextUrl.searchParams.get('type');
    const status = request.nextUrl.searchParams.get('status');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('crm_data_jobs')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (jobType) query = query.eq('job_type', jobType);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) {
      console.error('[DataJobs] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch data jobs' }, { status: 500 });
    }

    return NextResponse.json({ jobs: data || [], total: count || 0 });
  } catch (error) {
    console.error('[DataJobs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/data-jobs — create a data administration job
// ---------------------------------------------------------------------------
const createJobSchema = z.object({
  module_id: z.string().uuid().optional().nullable(),
  job_type: z.enum(JOB_TYPES),
  name: z.string().max(200).optional(),
  config: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    // mass_delete requires admin
    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    if (parsed.data.job_type === 'mass_delete' && profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — mass delete requires admin role' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('crm_data_jobs')
      .insert({
        organization_id: profile.organization_id,
        module_id: parsed.data.module_id || null,
        job_type: parsed.data.job_type,
        name: parsed.data.name || `${parsed.data.job_type} ${new Date().toISOString().slice(0, 10)}`,
        config: parsed.data.config || {},
        filters: parsed.data.filters || {},
        status: 'pending',
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[DataJobs] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create data job' }, { status: 500 });
    }

    return NextResponse.json({ job: data }, { status: 201 });
  } catch (error) {
    console.error('[DataJobs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/data-jobs — update job (approve, cancel)
// ---------------------------------------------------------------------------
const updateJobSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'review']).optional(),
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
    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    // If approving, set approved_by
    const updatePayload: Record<string, unknown> = { ...updates };
    if (updates.status === 'processing') {
      updatePayload.approved_by = profile.id;
      updatePayload.started_at = new Date().toISOString();
    }
    if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('crm_data_jobs')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[DataJobs] Update error:', error);
      return NextResponse.json({ error: 'Failed to update data job' }, { status: 500 });
    }

    return NextResponse.json({ job: data });
  } catch (error) {
    console.error('[DataJobs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/data-jobs?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing job id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_data_jobs')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[DataJobs] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete data job' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DataJobs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
