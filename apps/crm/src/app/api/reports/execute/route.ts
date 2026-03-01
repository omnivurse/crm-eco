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
  tasks: undefined, // crm_tasks doesn't use module_id
  activities: undefined,
};

interface Filter {
  column: string;
  operator: string;
  value: unknown;
}

interface Sorting {
  column: string;
  direction: 'asc' | 'desc';
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
      columns = [],
      filters = [] as Filter[],
      sorting = [] as Sorting[],
      page = 1,
      pageSize = 100,
    } = body;

    if (!dataSource) {
      return NextResponse.json({ error: 'Data source is required' }, { status: 400 });
    }

    const config = DATA_SOURCE_CONFIG[dataSource];
    if (!config) {
      return NextResponse.json({ error: 'Invalid data source' }, { status: 400 });
    }
    const { table, orgColumn } = config;

    // Validate column names to prevent injection (only allow alphanumeric + underscore)
    const COLUMN_NAME_RE = /^[a-z][a-z0-9_]*$/i;
    const safeColumns = (columns as string[]).filter((c: string) => COLUMN_NAME_RE.test(c));
    const selectString = safeColumns.length > 0 ? safeColumns.join(', ') : '*';

    // Validate filter and sorting column names
    for (const filter of filters as Filter[]) {
      if (!COLUMN_NAME_RE.test(filter.column)) {
        return NextResponse.json({ error: `Invalid filter column: ${filter.column}` }, { status: 400 });
      }
    }
    for (const sort of sorting as Sorting[]) {
      if (!COLUMN_NAME_RE.test(sort.column)) {
        return NextResponse.json({ error: `Invalid sort column: ${sort.column}` }, { status: 400 });
      }
    }

    let query = supabase.from(table).select(selectString, { count: 'exact' }) as any;

    // Always filter by organization (column name varies between legacy and CRM tables)
    query = query.eq(orgColumn, profile.organization_id);

    // Filter by module_id for CRM record types (look up module by key first)
    const moduleKey = DATA_SOURCE_MODULE_KEY[dataSource];
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

    // Apply filters
    for (const filter of filters) {
      const { column, operator, value } = filter;
      switch (operator) {
        case 'eq':
          query = query.eq(column, value);
          break;
        case 'neq':
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
          query = query.ilike(column, `%${value}%`);
          break;
        case 'in':
          query = query.in(column, value as unknown[]);
          break;
        case 'is_null':
          query = query.is(column, null);
          break;
        case 'is_not_null':
          query = query.not(column, 'is', null);
          break;
      }
    }

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
