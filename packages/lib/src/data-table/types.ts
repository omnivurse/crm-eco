/**
 * Shared list-query types for server-side DataTable fetches.
 * Kept in sync with `@crm-eco/ui/data-table` ListQuery shape.
 */

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_null'
  | 'is_not_null';

export type AppliedFilter = {
  key: string;
  operator: FilterOperator;
  value?: string | number | boolean | null;
};

export type ListQuery = {
  search?: string;
  filters: AppliedFilter[];
  sort?: { key: string; dir: 'asc' | 'desc' };
  page: number;
  pageSize: number;
};

export type ListResult<Row> = {
  rows: Row[];
  total: number;
};
