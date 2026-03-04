import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const EXPORT_TYPES = ['records', 'report', 'audit_logs', 'analytics', 'backup'] as const;
const EXPORT_FORMATS = ['csv', 'json', 'xlsx'] as const;

// ---------------------------------------------------------------------------
// GET /api/crm/export?status=completed&limit=20
// List export jobs for the current organization
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('crm_export_jobs')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) {
      console.error('[Export] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch export jobs' }, { status: 500 });
    }

    return NextResponse.json({ exports: data || [], total: count || 0 });
  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/export — create an export job
// The actual export processing runs asynchronously (background worker)
// ---------------------------------------------------------------------------
const createExportSchema = z.object({
  module_id: z.string().uuid().optional().nullable(),
  name: z.string().max(200).optional(),
  export_type: z.enum(EXPORT_TYPES).optional(),
  format: z.enum(EXPORT_FORMATS).optional(),
  columns: z.array(z.string()).optional().nullable(),
  column_labels: z.record(z.string()).optional(),
  filters: z.record(z.unknown()).optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
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
    const parsed = createExportSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Generate filename
    let fileName = parsed.data.name;
    if (!fileName && parsed.data.module_id) {
      const { data: mod } = await supabase
        .from('crm_modules')
        .select('name')
        .eq('id', parsed.data.module_id)
        .single();
      fileName = `${mod?.name || 'export'}_${new Date().toISOString().slice(0, 10)}`;
    }
    fileName = fileName || `export_${new Date().toISOString().slice(0, 10)}`;

    const format = parsed.data.format || 'csv';
    const fileNameWithExt = `${fileName}.${format}`;

    const { data, error } = await supabase
      .from('crm_export_jobs')
      .insert({
        organization_id: profile.organization_id,
        module_id: parsed.data.module_id || null,
        name: parsed.data.name || fileName,
        export_type: parsed.data.export_type || 'records',
        format,
        columns: parsed.data.columns || null,
        column_labels: parsed.data.column_labels || {},
        filters: parsed.data.filters || {},
        sort_by: parsed.data.sort_by || null,
        sort_order: parsed.data.sort_order || 'asc',
        status: 'pending',
        file_name: fileNameWithExt,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[Export] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create export job' }, { status: 500 });
    }

    // In production, this would trigger a background worker via Edge Function / cron
    // For now, perform inline export for small datasets
    try {
      await processExportInline(supabase, data, profile.organization_id);
    } catch (processError) {
      console.error('[Export] Process error:', processError);
      // Job is created; background worker can retry
    }

    // Re-fetch to get updated status
    const { data: updated } = await supabase
      .from('crm_export_jobs')
      .select('*')
      .eq('id', data.id)
      .single();

    return NextResponse.json({ export: updated || data }, { status: 201 });
  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Inline export processor (for small datasets; large exports use workers)
// ---------------------------------------------------------------------------
async function processExportInline(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: { id: string; module_id: string | null; format: string; columns: string[] | null; filters: Record<string, unknown>; sort_by: string | null; sort_order: string },
  orgId: string
) {
  // Mark as processing
  await supabase
    .from('crm_export_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id);

  try {
    if (!job.module_id) {
      throw new Error('module_id is required for record exports');
    }

    // Fetch records for the module
    let query = supabase
      .from('crm_records')
      .select('id, title, status, stage, owner_id, data, created_at, updated_at')
      .eq('org_id', orgId)
      .eq('module_id', job.module_id);

    // Apply filters
    if (job.filters && typeof job.filters === 'object') {
      const filters = job.filters as Record<string, unknown>;
      if (filters.status && typeof filters.status === 'string') {
        query = query.eq('status', filters.status);
      }
      if (filters.stage && typeof filters.stage === 'string') {
        query = query.eq('stage', filters.stage);
      }
    }

    // Apply sorting
    if (job.sort_by) {
      query = query.order(job.sort_by, { ascending: job.sort_order !== 'desc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Limit to 10k for inline processing
    query = query.limit(10000);

    const { data: records, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const totalRows = records?.length || 0;

    // Build export content
    let content: string;
    if (job.format === 'json') {
      const rows = (records || []).map((r) => flattenRecord(r, job.columns));
      content = JSON.stringify(rows, null, 2);
    } else {
      // CSV
      content = recordsToCsv(records || [], job.columns);
    }

    // For now, store as data URL (in production, upload to storage)
    const fileUrl = `data:text/${job.format};base64,${Buffer.from(content).toString('base64')}`;

    await supabase
      .from('crm_export_jobs')
      .update({
        status: 'completed',
        total_rows: totalRows,
        processed_rows: totalRows,
        file_url: fileUrl,
        file_size_bytes: Buffer.byteLength(content),
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .eq('id', job.id);
  } catch (err) {
    await supabase
      .from('crm_export_jobs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }
}

function flattenRecord(
  record: { id: string; title: string | null; status: string | null; stage: string | null; data: Record<string, unknown>; created_at: string; updated_at: string },
  columns: string[] | null
): Record<string, unknown> {
  const flat: Record<string, unknown> = {
    id: record.id,
    title: record.title,
    status: record.status,
    stage: record.stage,
    ...((record.data as Record<string, unknown>) || {}),
    created_at: record.created_at,
    updated_at: record.updated_at,
  };

  if (columns && columns.length > 0) {
    const filtered: Record<string, unknown> = {};
    for (const col of columns) {
      if (col in flat) filtered[col] = flat[col];
    }
    return filtered;
  }

  return flat;
}

function recordsToCsv(
  records: Array<{ id: string; title: string | null; status: string | null; stage: string | null; data: Record<string, unknown>; created_at: string; updated_at: string }>,
  columns: string[] | null
): string {
  if (records.length === 0) return '';

  const rows = records.map((r) => flattenRecord(r, columns));

  // Collect all unique keys
  const keys = columns && columns.length > 0
    ? columns
    : [...new Set(rows.flatMap((r) => Object.keys(r)))];

  // Header
  const header = keys.map(escapeCsvField).join(',');

  // Rows
  const csvRows = rows.map((row) =>
    keys.map((k) => escapeCsvField(String(row[k] ?? ''))).join(',')
  );

  return [header, ...csvRows].join('\n');
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/export?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing export id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_export_jobs')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[Export] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete export' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
