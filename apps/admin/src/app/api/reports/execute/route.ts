import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireAdminRole } from '@/lib/auth';

// Data source → (table, org-scoping column).
// `members` / `advisors` / `enrollments` / `commissions` use `organization_id`.
// CRM-side tables (`crm_records`, `crm_modules`, etc.) use `org_id`. Both
// shapes are valid in this codebase, so we map per data source instead of
// hard-coding one column name. Filtering with the wrong column would have
// PostgREST reject the query as `column "org_id" does not exist`.
const DATA_SOURCES: Record<string, { table: string; orgColumn: string }> = {
  members: { table: 'members', orgColumn: 'organization_id' },
  advisors: { table: 'advisors', orgColumn: 'organization_id' },
  enrollments: { table: 'enrollments', orgColumn: 'organization_id' },
  commissions: { table: 'commissions', orgColumn: 'organization_id' },
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

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// POST /api/reports/execute - Execute a report query
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { profile, error: authError } = await requireAdminRole(supabase);
    if (authError) return authError;

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

    const dataSourceConfig = DATA_SOURCES[dataSource];
    if (!dataSourceConfig) {
      return NextResponse.json({ error: 'Invalid data source' }, { status: 400 });
    }
    const { table, orgColumn } = dataSourceConfig;

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

    // Always filter by organization, using the column the target table
    // actually defines. Hard-coding `org_id` everywhere broke reports for
    // members / advisors / enrollments / commissions where the column is
    // called `organization_id`.
    query = query.eq(orgColumn, profile.organization_id);

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
      { error: 'Failed to execute report' },
      { status: 500 }
    );
  }
}
