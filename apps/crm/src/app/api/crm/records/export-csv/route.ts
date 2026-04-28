import { NextRequest, NextResponse } from 'next/server';
import {
  createCrmClient,
  getCurrentProfile,
  getFieldsForModule,
  getModuleByKey,
  getRecords,
} from '@/lib/crm/queries';
import type { CrmModule, CrmField, ViewFilter, ViewSort } from '@/lib/crm/types';
import {
  CSV_UTF8_BOM,
  escapeCsvCell,
  formatCsvDataLine,
  sanitizeExportFilenamePart,
} from '@/lib/crm/record-csv-export';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_COLUMNS = ['title', 'email', 'phone', 'status', 'stage', 'created_at'];
const EXPORT_PAGE_SIZE = 500;
const MAX_EXPORT_ROWS = 100_000;

function isValidFilter(f: unknown): f is ViewFilter {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  return typeof o.field === 'string' && typeof o.operator === 'string';
}

async function resolveModuleForOrg(
  orgId: string,
  moduleKey: string,
): Promise<CrmModule | null> {
  let crmModule = await getModuleByKey(orgId, moduleKey);

  if (!crmModule && moduleKey === 'contacts') {
    const membersModule = await getModuleByKey(orgId, 'members');
    if (membersModule) {
      crmModule = {
        ...membersModule,
        key: 'contacts',
        name: 'Contact',
        name_plural: 'Contacts',
      };
    }
  }

  return crmModule;
}

/**
 * GET /api/crm/records/export-csv
 *
 * Streams a UTF-8 CSV of all CRM records matching the same filters as the module list
 * (module_key, search, scope, territory, filters JSON, sort, optional saved view).
 *
 * Query params mirror the list URL: search, scope, territory, filters, sortField,
 * sortDirection, view (saved view id). Also: columns=comma-separated field keys.
 */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const moduleKey = searchParams.get('module_key');
  if (!moduleKey) {
    return NextResponse.json({ error: 'module_key is required' }, { status: 400 });
  }

  const crmModule = await resolveModuleForOrg(profile.organization_id, moduleKey);
  if (!crmModule) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  }

  const viewId = searchParams.get('view');
  const filtersRaw = searchParams.get('filters');
  let filters: ViewFilter[] = [];
  let sort: ViewSort[] = [];

  if (filtersRaw) {
    try {
      const parsed = JSON.parse(filtersRaw);
      if (Array.isArray(parsed)) {
        filters = parsed.filter(isValidFilter);
      }
    } catch {
      return NextResponse.json({ error: 'Invalid filters JSON' }, { status: 400 });
    }
  } else if (viewId) {
    const supabase = await createCrmClient();
    const { data: viewRow, error: viewErr } = await supabase
      .from('crm_views')
      .select('filters, sort')
      .eq('id', viewId)
      .eq('module_id', crmModule.id)
      .maybeSingle();

    if (viewErr) {
      console.error('[export-csv] view load:', viewErr.message);
      return NextResponse.json({ error: 'Failed to load view' }, { status: 500 });
    }

    if (viewRow) {
      const vf = viewRow.filters;
      const vs = viewRow.sort;
      if (Array.isArray(vf)) {
        filters = vf.filter(isValidFilter);
      }
      if (Array.isArray(vs)) {
        sort = vs as ViewSort[];
      }
    }
  }

  const sortField = searchParams.get('sortField');
  const sortDirection = searchParams.get('sortDirection');
  if (sortField) {
    sort = [{ field: sortField, direction: sortDirection === 'desc' ? 'desc' : 'asc' }];
  }

  const scopeRaw = searchParams.get('scope');
  const scope =
    scopeRaw === 'mine' || scopeRaw === 'downline' || scopeRaw === 'all'
      ? scopeRaw
      : 'all';

  const search = searchParams.get('search') || undefined;
  const territoryId = searchParams.get('territory') || undefined;

  const columnsParam = searchParams.get('columns');
  let columns =
    columnsParam
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (columns.length === 0) {
    columns = [...DEFAULT_COLUMNS];
  }

  let fields: CrmField[] = [];
  try {
    fields = await getFieldsForModule(crmModule.id);
  } catch (e) {
    console.warn('[export-csv] fields load:', e);
  }

  const headerLabels = columns.map((col) => {
    const field = fields.find((f) => f.key === col);
    return field?.label || col;
  });
  const headerLine = headerLabels.map(escapeCsvCell).join(',');

  const filename = `${sanitizeExportFilenamePart(crmModule.key)}-${format(new Date(), 'yyyy-MM-dd')}.csv`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let exported = 0;
      let page = 1;

      try {
        controller.enqueue(encoder.encode(CSV_UTF8_BOM));
        controller.enqueue(encoder.encode(headerLine + '\n'));

        for (;;) {
          const { records } = await getRecords({
            moduleId: crmModule.id,
            orgId: crmModule.org_id,
            page,
            pageSize: EXPORT_PAGE_SIZE,
            filters,
            sort,
            search,
            scope,
            territoryId,
            includeCount: false,
          });

          if (!records.length) {
            break;
          }

          for (const record of records) {
            if (exported >= MAX_EXPORT_ROWS) {
              controller.enqueue(
                encoder.encode(
                  `\n# Truncated: export limited to ${MAX_EXPORT_ROWS} rows\n`,
                ),
              );
              controller.close();
              return;
            }
            controller.enqueue(encoder.encode(formatCsvDataLine(record, columns) + '\n'));
            exported += 1;
          }

          if (records.length < EXPORT_PAGE_SIZE) {
            break;
          }
          page += 1;
        }

        controller.close();
      } catch (e) {
        console.error('[export-csv] stream error:', e);
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
