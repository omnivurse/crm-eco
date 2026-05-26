import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Export-jobs admin endpoint — exports CRM data as CSV / JSON / XLSX.
 *
 * Persistence: rides on top of `crm_import_jobs` with
 * `source_type = 'export'` and the export-specific fields (export_type,
 * format, columns, column_labels, filters, sort, file_size_bytes)
 * stashed inside the `stats` JSONB. The `download_url` + `expires_at`
 * columns (added by migration 010) are first-class on the row so the
 * UI can hand them straight to the browser.
 */

const EXPORT_TYPES = ['records', 'report', 'audit_logs', 'analytics', 'backup'] as const;
const EXPORT_FORMATS = ['csv', 'json', 'xlsx'] as const;
const SOURCE_TYPE = 'export';

type ExportFormat = (typeof EXPORT_FORMATS)[number];

interface ExportJobApi {
  id: string;
  name: string | null;
  export_type: string;
  format: ExportFormat;
  status: string;
  total_rows: number | null;
  processed_rows: number | null;
  file_name: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

interface ImportJobRow {
  id: string;
  org_id: string;
  module_id: string | null;
  source_type: string;
  file_name: string | null;
  status: string | null;
  total_rows: number | null;
  processed_rows: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  created_by: string | null;
  download_url: string | null;
  expires_at: string | null;
  stats: Record<string, unknown> | null;
}

function rowToApi(row: ImportJobRow): ExportJobApi {
  const stats = (row.stats || {}) as Record<string, unknown>;
  return {
    id: row.id,
    name: (stats.name as string | null) ?? null,
    export_type: (stats.export_type as string) || 'records',
    format: ((stats.format as ExportFormat) || 'csv'),
    status: row.status || 'pending',
    total_rows: row.total_rows,
    processed_rows: row.processed_rows,
    file_name: row.file_name,
    file_url: row.download_url,
    file_size_bytes: (stats.file_size_bytes as number | null) ?? null,
    error_message: row.error_message,
    created_at: row.created_at ?? new Date().toISOString(),
    started_at: row.started_at,
    completed_at: row.completed_at,
    expires_at: row.expires_at,
  };
}

const ROW_COLUMNS =
  'id, org_id, module_id, source_type, file_name, status, total_rows, processed_rows, error_message, started_at, completed_at, created_at, created_by, download_url, expires_at, stats';

// ---------------------------------------------------------------------------
// GET /api/crm/export?status=completed&limit=20
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
      .from('crm_import_jobs')
      .select(ROW_COLUMNS, { count: 'exact' })
      .eq('org_id', profile.organization_id)
      .eq('source_type', SOURCE_TYPE)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query.returns<ImportJobRow[]>();
    if (error) {
      console.error('[Export] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch export jobs' }, { status: 500 });
    }

    return NextResponse.json({
      exports: (data || []).map(rowToApi),
      total: count || 0,
    });
  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/export — create + (inline) process an export job
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

    const parsed = createExportSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Derive a friendly file name; fall back to the module name if available.
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

    const format: ExportFormat = parsed.data.format || 'csv';
    const fileNameWithExt = `${fileName}.${format}`;

    const { data, error } = await supabase
      .from('crm_import_jobs')
      .insert({
        org_id: profile.organization_id,
        module_id: parsed.data.module_id || null,
        source_type: SOURCE_TYPE,
        status: 'pending',
        file_name: fileNameWithExt,
        created_by: profile.id,
        stats: {
          name: parsed.data.name || fileName,
          export_type: parsed.data.export_type || 'records',
          format,
          columns: parsed.data.columns || null,
          column_labels: parsed.data.column_labels || {},
          filters: parsed.data.filters || {},
          sort_by: parsed.data.sort_by || null,
          sort_order: parsed.data.sort_order || 'asc',
        },
      })
      .select(ROW_COLUMNS)
      .single()
      .returns<ImportJobRow>();

    if (error) {
      console.error('[Export] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create export job' }, { status: 500 });
    }

    // Inline-process small datasets. Large ones can be picked up by a
    // background worker that polls source_type='export', status='pending'.
    try {
      await processExportInline(supabase, data, profile.organization_id);
    } catch (processError) {
      console.error('[Export] Process error:', processError);
    }

    const { data: updated } = await supabase
      .from('crm_import_jobs')
      .select(ROW_COLUMNS)
      .eq('id', data.id)
      .single()
      .returns<ImportJobRow>();

    return NextResponse.json({ export: rowToApi(updated || data) }, { status: 201 });
  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Inline export processor — for small datasets (< 10k rows)
// ---------------------------------------------------------------------------
async function processExportInline(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: ImportJobRow,
  orgId: string
): Promise<void> {
  await supabase
    .from('crm_import_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id);

  const stats = (job.stats || {}) as Record<string, unknown>;
  const format = (stats.format as ExportFormat) || 'csv';
  const columns = (stats.columns as string[] | null) || null;
  const filters = (stats.filters as Record<string, unknown>) || {};
  const sortBy = (stats.sort_by as string | null) || null;
  const sortOrder = (stats.sort_order as 'asc' | 'desc') || 'desc';

  try {
    if (!job.module_id) {
      throw new Error('module_id is required for record exports');
    }

    let query = supabase
      .from('crm_records')
      .select('id, title, status, stage, owner_id, data, created_at, updated_at')
      .eq('org_id', orgId)
      .eq('module_id', job.module_id);

    if (filters.status && typeof filters.status === 'string') {
      query = query.eq('status', filters.status);
    }
    if (filters.stage && typeof filters.stage === 'string') {
      query = query.eq('stage', filters.stage);
    }

    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder !== 'desc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.limit(10000);

    const { data: records, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const totalRows = records?.length || 0;

    const content =
      format === 'json'
        ? JSON.stringify((records || []).map((r) => flattenRecord(r, columns)), null, 2)
        : recordsToCsv(records || [], columns);

    const fileUrl = `data:text/${format};base64,${Buffer.from(content).toString('base64')}`;
    const sizeBytes = Buffer.byteLength(content);

    await supabase
      .from('crm_import_jobs')
      .update({
        status: 'completed',
        total_rows: totalRows,
        processed_rows: totalRows,
        download_url: fileUrl,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date().toISOString(),
        stats: { ...stats, file_size_bytes: sizeBytes },
      })
      .eq('id', job.id);
  } catch (err) {
    await supabase
      .from('crm_import_jobs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }
}

function flattenRecord(
  record: {
    id: string;
    title: string | null;
    status: string | null;
    stage: string | null;
    data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  },
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
  records: Array<{
    id: string;
    title: string | null;
    status: string | null;
    stage: string | null;
    data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>,
  columns: string[] | null
): string {
  if (records.length === 0) return '';

  const rows = records.map((r) => flattenRecord(r, columns));
  const keys =
    columns && columns.length > 0
      ? columns
      : [...new Set(rows.flatMap((r) => Object.keys(r)))];

  const header = keys.map(escapeCsvField).join(',');
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
      .from('crm_import_jobs')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .eq('source_type', SOURCE_TYPE);

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
