import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Data-job admin endpoint — dedupe, merge, mass-update, mass-delete, enrich.
 *
 * Persistence: we reuse `crm_import_jobs` with `source_type = 'data_job'`
 * as the discriminator and stash the data-job-specific fields (job_type,
 * name, config, filters, approved_by) inside the `stats` JSONB column.
 * The API contract returned to the UI remains stable.
 */

const JOB_TYPES = ['deduplicate', 'merge', 'mass_update', 'mass_delete', 'enrich'] as const;
type JobType = (typeof JOB_TYPES)[number];

const STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'review'] as const;
type JobStatus = (typeof STATUSES)[number];

const SOURCE_TYPE = 'data_job';

interface DataJobApi {
  id: string;
  job_type: JobType;
  name: string | null;
  status: JobStatus;
  config: Record<string, unknown>;
  filters: Record<string, unknown>;
  total_records: number | null;
  processed_records: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
}

interface ImportJobRow {
  id: string;
  org_id: string;
  module_id: string | null;
  source_type: string;
  status: string | null;
  total_rows: number | null;
  processed_rows: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  created_by: string | null;
  stats: Record<string, unknown> | null;
}

/** Project a DB row into the API contract the DataJobsTab UI expects. */
function rowToApi(row: ImportJobRow): DataJobApi {
  const stats = (row.stats || {}) as Record<string, unknown>;
  return {
    id: row.id,
    job_type: ((stats.job_type as JobType) ?? 'enrich') as JobType,
    name: (stats.name as string | null) ?? null,
    status: ((row.status as JobStatus) ?? 'pending') as JobStatus,
    config: ((stats.config as Record<string, unknown>) ?? {}),
    filters: ((stats.filters as Record<string, unknown>) ?? {}),
    total_records: row.total_rows,
    processed_records: row.processed_rows,
    error_message: row.error_message,
    created_at: row.created_at ?? new Date().toISOString(),
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_by: row.created_by,
  };
}

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
      .from('crm_import_jobs')
      .select(
        'id, org_id, module_id, source_type, status, total_rows, processed_rows, error_message, started_at, completed_at, created_at, created_by, stats',
        { count: 'exact' }
      )
      .eq('org_id', profile.organization_id)
      .eq('source_type', SOURCE_TYPE)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (jobType) query = query.contains('stats', { job_type: jobType });

    const { data, error, count } = await query.returns<ImportJobRow[]>();
    if (error) {
      console.error('[DataJobs] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch data jobs' }, { status: 500 });
    }

    return NextResponse.json({
      jobs: (data || []).map(rowToApi),
      total: count || 0,
    });
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

    const parsed = createJobSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    if (parsed.data.job_type === 'mass_delete' && profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — mass delete requires admin role' }, { status: 403 });
    }

    const displayName =
      parsed.data.name || `${parsed.data.job_type} ${new Date().toISOString().slice(0, 10)}`;

    const { data, error } = await supabase
      .from('crm_import_jobs')
      .insert({
        org_id: profile.organization_id,
        module_id: parsed.data.module_id || null,
        source_type: SOURCE_TYPE,
        status: 'pending',
        created_by: profile.id,
        stats: {
          job_type: parsed.data.job_type,
          name: displayName,
          config: parsed.data.config || {},
          filters: parsed.data.filters || {},
        },
      })
      .select(
        'id, org_id, module_id, source_type, status, total_rows, processed_rows, error_message, started_at, completed_at, created_at, created_by, stats'
      )
      .single()
      .returns<ImportJobRow>();

    if (error) {
      console.error('[DataJobs] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create data job' }, { status: 500 });
    }

    return NextResponse.json({ job: rowToApi(data) }, { status: 201 });
  } catch (error) {
    console.error('[DataJobs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/data-jobs — approve / cancel a job
// ---------------------------------------------------------------------------
const updateJobSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const parsed = updateJobSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Read current stats so we can merge approval metadata without clobbering it
    const { data: existing, error: readError } = await supabase
      .from('crm_import_jobs')
      .select('stats')
      .eq('id', parsed.data.id)
      .eq('org_id', profile.organization_id)
      .eq('source_type', SOURCE_TYPE)
      .single();
    if (readError || !existing) {
      return NextResponse.json({ error: 'Data job not found' }, { status: 404 });
    }

    const currentStats = ((existing.stats as Record<string, unknown> | null) ?? {});
    const updatePayload: Record<string, unknown> = {};

    if (parsed.data.status) updatePayload.status = parsed.data.status;

    if (parsed.data.status === 'processing') {
      updatePayload.started_at = new Date().toISOString();
      updatePayload.stats = { ...currentStats, approved_by: profile.id };
    }
    if (
      parsed.data.status === 'completed' ||
      parsed.data.status === 'failed' ||
      parsed.data.status === 'cancelled'
    ) {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('crm_import_jobs')
      .update(updatePayload)
      .eq('id', parsed.data.id)
      .eq('org_id', profile.organization_id)
      .eq('source_type', SOURCE_TYPE)
      .select(
        'id, org_id, module_id, source_type, status, total_rows, processed_rows, error_message, started_at, completed_at, created_at, created_by, stats'
      )
      .single()
      .returns<ImportJobRow>();

    if (error) {
      console.error('[DataJobs] Update error:', error);
      return NextResponse.json({ error: 'Failed to update data job' }, { status: 500 });
    }

    return NextResponse.json({ job: rowToApi(data) });
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
      .from('crm_import_jobs')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .eq('source_type', SOURCE_TYPE);

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
