import type { AppliedFilter, ListQuery, ListResult } from './types';

/**
 * Minimal Supabase query builder surface used by fetchSupabaseList.
 * Avoids coupling to generated Database types for dynamic table names.
 */
export type SupabaseListClient = {
  from: (table: string) => {
    select: (
      columns: string,
      opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
    ) => SupabaseFilterBuilder;
  };
};

type SupabaseFilterBuilder = {
  eq: (column: string, value: unknown) => SupabaseFilterBuilder;
  neq: (column: string, value: unknown) => SupabaseFilterBuilder;
  ilike: (column: string, pattern: string) => SupabaseFilterBuilder;
  or: (filters: string) => SupabaseFilterBuilder;
  gt: (column: string, value: unknown) => SupabaseFilterBuilder;
  gte: (column: string, value: unknown) => SupabaseFilterBuilder;
  lt: (column: string, value: unknown) => SupabaseFilterBuilder;
  lte: (column: string, value: unknown) => SupabaseFilterBuilder;
  is: (column: string, value: null) => SupabaseFilterBuilder;
  not: (column: string, operator: string, value: string) => SupabaseFilterBuilder;
  order: (
    column: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean },
  ) => SupabaseFilterBuilder;
  range: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string; code?: string } | null;
    count: number | null;
  }>;
};

export type FetchSupabaseListOptions = {
  client: SupabaseListClient;
  table: string;
  select: string;
  organizationId: string;
  /** Columns for OR ilike search. */
  searchColumns?: string[];
  /** Allow-list of columns that may be sorted (security). */
  sortableColumns?: string[];
  /** Allow-list of filter keys. */
  filterableColumns?: string[];
  query: ListQuery;
  /** Extra equality filters always applied. */
  fixedFilters?: Record<string, string | number | boolean>;
  /** Default sort when query.sort is unset. */
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
};

function applyFilter(builder: SupabaseFilterBuilder, filter: AppliedFilter): SupabaseFilterBuilder {
  const { key, operator, value } = filter;
  switch (operator) {
    case 'equals':
      return builder.eq(key, value);
    case 'not_equals':
      return builder.neq(key, value);
    case 'contains':
      return builder.ilike(key, `%${value ?? ''}%`);
    case 'starts_with':
      return builder.ilike(key, `${value ?? ''}%`);
    case 'ends_with':
      return builder.ilike(key, `%${value ?? ''}`);
    case 'gt':
      return builder.gt(key, value);
    case 'gte':
      return builder.gte(key, value);
    case 'lt':
      return builder.lt(key, value);
    case 'lte':
      return builder.lte(key, value);
    case 'is_null':
      return builder.is(key, null);
    case 'is_not_null':
      return builder.not(key, 'is', 'null');
    default:
      return builder;
  }
}

/**
 * Server-side list fetch: org scope + search + filters + sort + range pagination + exact count.
 * Fixes the common `.limit(500)` + client-paginate bug.
 */
export async function fetchSupabaseList<Row>(
  options: FetchSupabaseListOptions,
): Promise<ListResult<Row>> {
  const {
    client,
    table,
    select,
    organizationId,
    searchColumns = [],
    sortableColumns,
    filterableColumns,
    query,
    fixedFilters,
    defaultSort = { key: 'created_at', dir: 'desc' },
  } = options;

  let builder = client
    .from(table)
    .select(select, { count: 'exact' })
    .eq('organization_id', organizationId) as unknown as SupabaseFilterBuilder;

  if (fixedFilters) {
    for (const [key, value] of Object.entries(fixedFilters)) {
      builder = builder.eq(key, value);
    }
  }

  if (query.search && searchColumns.length > 0) {
    const term = query.search.replace(/[%_,]/g, '');
    if (term) {
      const ors = searchColumns.map((col) => `${col}.ilike.%${term}%`).join(',');
      builder = builder.or(ors);
    }
  }

  for (const filter of query.filters) {
    if (filterableColumns && !filterableColumns.includes(filter.key)) continue;
    if (filter.value === 'all' || filter.value === '' || filter.value === undefined) continue;
    builder = applyFilter(builder, filter);
  }

  const sort = query.sort ?? defaultSort;
  const allowed = !sortableColumns || sortableColumns.includes(sort.key);
  if (allowed) {
    builder = builder.order(sort.key, { ascending: sort.dir === 'asc' });
  }

  const from = Math.max(0, (query.page - 1) * query.pageSize);
  const to = from + query.pageSize - 1;

  const { data, error, count } = await builder.range(from, to);

  if (error) {
    // Missing table → empty (matches prior payables tolerance for 42P01)
    if (error.code === '42P01') {
      return { rows: [], total: 0 };
    }
    throw new Error(error.message);
  }

  return {
    rows: (data ?? []) as Row[],
    total: count ?? 0,
  };
}
