import type * as React from 'react';

/** Filter operator — mirrors CRM FilterBuilder; kept domain-agnostic. */
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

export type ActionContext = {
  refresh: () => Promise<void>;
};

export type ColumnDef<Row> = {
  key: string;
  header: string;
  accessor: (row: Row) => unknown;
  cell?: (row: Row) => React.ReactNode;
  sortable?: boolean;
  defaultWidth?: number;
  align?: 'left' | 'right' | 'center';
  exportValue?: (row: Row) => string | number;
};

export type FilterDef = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean';
  options?: { value: string; label: string }[];
  /** Default operator when applying a select/text value. */
  operator?: FilterOperator;
};

export type RowAction<Row> = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  run: (row: Row, ctx: ActionContext) => void | Promise<void>;
  visible?: (row: Row) => boolean;
  /** Candidate 3 permission key — evaluated via useCan(). */
  permission?: string;
  variant?: 'default' | 'destructive';
};

export type BulkAction<Row> = {
  id: string;
  label: string;
  run: (rows: Row[], ctx: ActionContext) => void | Promise<void>;
  permission?: string;
  confirm?: string;
};

export type DataSource<Row> = {
  kind: 'fetcher';
  load: (q: ListQuery) => Promise<ListResult<Row>>;
};

export type ResourceDescriptor<Row> = {
  resource: string;
  title: string;
  getRowId: (row: Row) => string;
  columns: ColumnDef<Row>[];
  filters?: FilterDef[];
  searchPlaceholder?: string;
  dataSource: DataSource<Row>;
  rowActions?: RowAction<Row>[];
  bulkActions?: BulkAction<Row>[];
  toolbar?: React.ReactNode;
  onRowClick?: (row: Row) => void;
  /** Reserved for saved_views wiring; no-op in v1 when true. */
  savedViews?: boolean;
  export?: boolean | { filename?: string };
  emptyState?: {
    title: string;
    description?: string;
    action?: React.ReactNode;
  };
  pageSize?: number;
};

export type ResourceListState<Row> = {
  rows: Row[];
  total: number;
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  filters: AppliedFilter[];
  setFilter: (key: string, value: string | null, operator?: FilterOperator) => void;
  clearFilters: () => void;
  sort: ListQuery['sort'];
  toggleSort: (key: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  selectAllPage: () => void;
  columnWidths: Record<string, number>;
  onResizeStart: (col: string, startX: number) => void;
  refresh: () => Promise<void>;
  exportCsv: () => void;
  ctx: ActionContext;
};
