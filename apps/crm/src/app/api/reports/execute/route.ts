import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Data source configuration: table name and org column
const DATA_SOURCE_CONFIG: Record<string, { table: string; orgColumn: string }> = {
  // Legacy tables use organization_id
  members: { table: 'members', orgColumn: 'organization_id' },
  advisors: { table: 'advisors', orgColumn: 'organization_id' },
  enrollments: { table: 'enrollments', orgColumn: 'organization_id' },
  commissions: { table: 'commissions', orgColumn: 'organization_id' },
  products: { table: 'products', orgColumn: 'organization_id' },
  commission_rates: { table: 'commission_rates', orgColumn: 'organization_id' },
  // CRM tables use org_id
  deals: { table: 'crm_records', orgColumn: 'org_id' },
  contacts: { table: 'crm_records', orgColumn: 'org_id' },
  leads: { table: 'crm_records', orgColumn: 'org_id' },
  accounts: { table: 'crm_records', orgColumn: 'org_id' },
  tasks: { table: 'crm_tasks', orgColumn: 'org_id' },
  activities: { table: 'crm_tasks', orgColumn: 'org_id' },
};

// Module key to look up crm_modules.id for filtering crm_records by module_id
const DATA_SOURCE_MODULE_KEY: Record<string, string | undefined> = {
  deals: 'deals',
  contacts: 'contacts',
  leads: 'leads',
  accounts: 'accounts',
  tasks: undefined,
  activities: undefined,
};

interface ReportFilter {
  field?: string;
  column?: string;
  operator: string;
  value: unknown;
  value2?: unknown;
}

interface ReportSorting {
  column: string;
  direction: 'asc' | 'desc';
}

interface ReportGrouping {
  field: string;
  order?: 'asc' | 'desc';
}

interface ReportAggregation {
  field: string;
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  label?: string;
}

interface RelatedModule {
  module_key: string;
  module_id: string;
  join_type: 'inclusive' | 'exclusive';
}

const COLUMN_NAME_RE = /^[a-z][a-z0-9_]*$/i;

function validateColumnName(name: string): boolean {
  return COLUMN_NAME_RE.test(name);
}

// POST /api/reports/execute - Execute a report query
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      dataSource,
      moduleId,
      columns = [],
      filters = [] as ReportFilter[],
      filterLogic,
      sorting = [] as ReportSorting[],
      grouping = [] as ReportGrouping[],
      aggregations = [] as ReportAggregation[],
      relatedModules = [] as RelatedModule[],
      page = 1,
      pageSize = 100,
      // Capacity/scope fields
      productType,
      advisorId,
      includeDownline = false,
      scope = 'all',
    } = body;

    const effectiveDataSource = dataSource || '';

    // ----- Server-side aggregation via RPC -----
    if (grouping.length > 0 || aggregations.length > 0) {
      const config = effectiveDataSource ? DATA_SOURCE_CONFIG[effectiveDataSource] : null;
      const table = config?.table || 'crm_records';
      const orgColumn = config?.orgColumn || 'org_id';

      // Resolve module_id for CRM record tables
      let resolvedModuleId = moduleId || null;
      if (!resolvedModuleId && effectiveDataSource) {
        const moduleKey = DATA_SOURCE_MODULE_KEY[effectiveDataSource];
        if (moduleKey) {
          const { data: moduleData } = await supabase
            .from('crm_modules')
            .select('id')
            .eq('org_id', profile.organization_id)
            .eq('key', moduleKey)
            .single();
          resolvedModuleId = moduleData?.id || null;
        }
      }

      // Normalize filters: support both field and column names
      const normalizedFilters = (filters as ReportFilter[]).map(f => ({
        field: f.field || f.column || '',
        operator: f.operator,
        value: f.value,
        value2: f.value2,
      }));

      const { data: rpcData, error: rpcError } = await supabase.rpc('execute_report_aggregation', {
        p_org_id: profile.organization_id,
        p_table: table,
        p_org_column: orgColumn,
        p_module_id: resolvedModuleId,
        p_filters: JSON.stringify(normalizedFilters),
        p_filter_logic: filterLogic?.logic || 'and',
        p_grouping: JSON.stringify(grouping),
        p_aggregations: JSON.stringify(aggregations),
        p_sorting: JSON.stringify(sorting),
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
        p_product_type: productType || null,
        p_advisor_id: advisorId || null,
        p_include_downline: includeDownline,
      });

      if (rpcError) {
        console.error('Aggregation RPC error:', rpcError);
        return NextResponse.json(
          { error: 'Aggregation query failed: ' + rpcError.message },
          { status: 500 }
        );
      }

      const result = rpcData || { rows: [], total: 0 };
      return NextResponse.json({
        data: result.rows || [],
        total: result.total || 0,
        page,
        pageSize,
        isAggregated: true,
      });
    }

    // ----- Multi-module query via RPC -----
    if (relatedModules.length > 0 && moduleId) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('execute_report_query', {
        p_org_id: profile.organization_id,
        p_primary_module_id: moduleId,
        p_related_modules: JSON.stringify(relatedModules),
        p_columns: JSON.stringify(columns),
        p_filters: JSON.stringify(filters),
        p_filter_logic: filterLogic ? JSON.stringify(filterLogic) : null,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        // Fall through to simple query on RPC failure
      } else {
        return NextResponse.json({
          data: rpcData || [],
          total: (rpcData || []).length,
          page,
          pageSize,
        });
      }
    }

    // ----- Simple single-table query -----
    const config = effectiveDataSource
      ? DATA_SOURCE_CONFIG[effectiveDataSource]
      : null;

    if (!config && !moduleId) {
      return NextResponse.json({ error: 'Data source or module is required' }, { status: 400 });
    }

    const table = config?.table || 'crm_records';
    const orgColumn = config?.orgColumn || 'org_id';

    // Validate column names
    const safeColumns = (columns as string[]).filter((c: string) => validateColumnName(c));
    const selectString = safeColumns.length > 0 ? safeColumns.join(', ') : '*';

    for (const filter of filters as ReportFilter[]) {
      const col = filter.field || filter.column || '';
      if (col && !validateColumnName(col)) {
        return NextResponse.json({ error: `Invalid filter column: ${col}` }, { status: 400 });
      }
    }
    for (const sort of sorting as ReportSorting[]) {
      if (!validateColumnName(sort.column)) {
        return NextResponse.json({ error: `Invalid sort column: ${sort.column}` }, { status: 400 });
      }
    }

    let query = supabase.from(table).select(selectString, { count: 'exact' }) as any;

    // Filter by organization
    query = query.eq(orgColumn, profile.organization_id);

    // Filter by module_id
    if (moduleId) {
      query = query.eq('module_id', moduleId);
    } else {
      const moduleKey = DATA_SOURCE_MODULE_KEY[effectiveDataSource];
      if (moduleKey) {
        const { data: moduleData } = await supabase
          .from('crm_modules')
          .select('id')
          .eq('org_id', profile.organization_id)
          .eq('key', moduleKey)
          .single();
        if (!moduleData) {
          return NextResponse.json({ data: [], total: 0, page, pageSize });
        }
        query = query.eq('module_id', (moduleData as { id: string }).id);
      }
    }

    // Product type filter for legacy tables
    if (productType) {
      query = query.eq('product_type', productType);
    }

    // Advisor filter with optional downline
    if (advisorId) {
      if (includeDownline) {
        const { data: downlineIds } = await supabase.rpc('get_advisor_downline_ids', {
          p_advisor_id: advisorId,
          p_org_id: profile.organization_id,
        });
        if (downlineIds && downlineIds.length > 0) {
          query = query.in('advisor_id', downlineIds);
        } else {
          query = query.eq('advisor_id', advisorId);
        }
      } else {
        query = query.eq('advisor_id', advisorId);
      }
    }

    // Scope-based filtering
    if (scope === 'mine' && profile.id) {
      // For CRM records, filter by owner_id; for legacy tables, look up advisor_id
      if (table === 'crm_records') {
        query = query.eq('owner_id', profile.id);
      }
    }

    // Apply filters
    query = applyFilters(query, filters);

    // Apply sorting
    if (sorting.length > 0) {
      for (const sort of sorting) {
        query = query.order(sort.column, { ascending: sort.direction === 'asc' });
      }
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error executing report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute report' },
      { status: 500 }
    );
  }
}

function applyFilters(query: any, filters: ReportFilter[]): any {
  for (const filter of filters) {
    const column = filter.field || filter.column || '';
    if (!column) continue;
    const { operator, value, value2 } = filter;
    switch (operator) {
      case 'eq':
      case 'equals':
        query = query.eq(column, value);
        break;
      case 'neq':
      case 'not_equals':
        query = query.neq(column, value);
        break;
      case 'gt':
        query = query.gt(column, value);
        break;
      case 'gte':
        query = query.gte(column, value);
        break;
      case 'lt':
        query = query.lt(column, value);
        break;
      case 'lte':
        query = query.lte(column, value);
        break;
      case 'like':
      case 'ilike':
      case 'contains':
        query = query.ilike(column, `%${value}%`);
        break;
      case 'not_contains':
        query = query.not(column, 'ilike', `%${value}%`);
        break;
      case 'starts_with':
        query = query.ilike(column, `${value}%`);
        break;
      case 'ends_with':
        query = query.ilike(column, `%${value}`);
        break;
      case 'between':
        if (value != null && value2 != null) {
          query = query.gte(column, value).lte(column, value2);
        }
        break;
      case 'in':
      case 'is_any_of':
        if (typeof value === 'string') {
          query = query.in(column, value.split(',').map((v: string) => v.trim()));
        } else {
          query = query.in(column, Array.isArray(value) ? value : [value]);
        }
        break;
      case 'is_null':
      case 'is_empty':
        query = query.is(column, null);
        break;
      case 'is_not_null':
      case 'is_not_empty':
        query = query.not(column, 'is', null);
        break;
      case 'is_true':
        query = query.eq(column, true);
        break;
      case 'is_false':
        query = query.eq(column, false);
        break;
      case 'before':
        query = query.lt(column, value);
        break;
      case 'after':
        query = query.gt(column, value);
        break;
    }
  }
  return query;
}
