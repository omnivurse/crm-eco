import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Data source to table mapping
const DATA_SOURCE_TABLES: Record<string, string> = {
  // Legacy tables
  members: 'members',
  advisors: 'advisors',
  enrollments: 'enrollments',
  commissions: 'commissions',
  // CRM tables
  deals: 'crm_records',
  contacts: 'crm_records',
  leads: 'crm_records',
  accounts: 'crm_records',
  tasks: 'crm_tasks',
  activities: 'crm_tasks',
};

// Module key to filter CRM records by module
const DATA_SOURCE_MODULE_KEY: Record<string, string | undefined> = {
  deals: 'deals',
  contacts: 'contacts',
  leads: 'leads',
  accounts: 'accounts',
  tasks: undefined, // crm_tasks doesn't have module_key
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

    const table = DATA_SOURCE_TABLES[dataSource];
    if (!table) {
      return NextResponse.json({ error: 'Invalid data source' }, { status: 400 });
    }

    // Build the select string
    const selectString = columns.length > 0 ? columns.join(', ') : '*';

    let query = supabase.from(table).select(selectString, { count: 'exact' }) as any;

    // Always filter by organization
    query = query.eq('org_id', profile.organization_id);

    // Filter by module_key for CRM record types
    const moduleKey = DATA_SOURCE_MODULE_KEY[dataSource];
    if (moduleKey) {
      query = query.eq('module_key', moduleKey);
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
