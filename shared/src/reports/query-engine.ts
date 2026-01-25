import type {
  DataSource,
  ColumnDefinition,
  Filter,
  Grouping,
  Aggregation,
  Sorting,
  ReportDefinition,
  ColumnType,
} from './types.js';

// ============================================================================
// DATA SOURCE DEFINITIONS
// ============================================================================

interface JoinDefinition {
  table: string;
  alias: string;
  on: string;
  type: 'LEFT' | 'INNER';
}

interface DataSourceConfig {
  baseTable: string;
  alias: string;
  columns: ColumnDefinition[];
  joins: Record<string, JoinDefinition>;
}

// ============================================================================
// COLUMN DEFINITIONS BY DATA SOURCE
// ============================================================================

const MEMBERS_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'Member ID', table: 'members', type: 'text' },
  { key: 'member_number', label: 'Member Number', table: 'members', type: 'text' },
  { key: 'first_name', label: 'First Name', table: 'members', type: 'text' },
  { key: 'last_name', label: 'Last Name', table: 'members', type: 'text' },
  { key: 'email', label: 'Email', table: 'members', type: 'email' },
  { key: 'phone', label: 'Phone', table: 'members', type: 'phone' },
  { key: 'date_of_birth', label: 'Date of Birth', table: 'members', type: 'date' },
  { key: 'state', label: 'State', table: 'members', type: 'text' },
  { key: 'zip_code', label: 'ZIP Code', table: 'members', type: 'text' },
  { key: 'status', label: 'Status', table: 'members', type: 'status' },
  { key: 'enrollment_date', label: 'Enrollment Date', table: 'members', type: 'date' },
  { key: 'effective_date', label: 'Effective Date', table: 'members', type: 'date' },
  { key: 'termination_date', label: 'Termination Date', table: 'members', type: 'date' },
  { key: 'created_at', label: 'Created At', table: 'members', type: 'datetime' },
  // Joined columns
  { key: 'advisor.first_name', label: 'Advisor First Name', table: 'advisors', type: 'text', joinRequired: 'advisor' },
  { key: 'advisor.last_name', label: 'Advisor Last Name', table: 'advisors', type: 'text', joinRequired: 'advisor' },
  { key: 'advisor.email', label: 'Advisor Email', table: 'advisors', type: 'email', joinRequired: 'advisor' },
  { key: 'advisor.code', label: 'Advisor Code', table: 'advisors', type: 'text', joinRequired: 'advisor' },
];

const ADVISORS_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'Advisor ID', table: 'advisors', type: 'text' },
  { key: 'code', label: 'Advisor Code', table: 'advisors', type: 'text' },
  { key: 'first_name', label: 'First Name', table: 'advisors', type: 'text' },
  { key: 'last_name', label: 'Last Name', table: 'advisors', type: 'text' },
  { key: 'email', label: 'Email', table: 'advisors', type: 'email' },
  { key: 'phone', label: 'Phone', table: 'advisors', type: 'phone' },
  { key: 'state', label: 'State', table: 'advisors', type: 'text' },
  { key: 'status', label: 'Status', table: 'advisors', type: 'status' },
  { key: 'licensed_states', label: 'Licensed States', table: 'advisors', type: 'json' },
  { key: 'created_at', label: 'Created At', table: 'advisors', type: 'datetime' },
  // Joined columns
  { key: 'level.name', label: 'Agent Level', table: 'agent_levels', type: 'text', joinRequired: 'level' },
  { key: 'level.rank', label: 'Level Rank', table: 'agent_levels', type: 'number', joinRequired: 'level' },
  { key: 'level.commission_rate', label: 'Commission Rate', table: 'agent_levels', type: 'percent', joinRequired: 'level' },
  { key: 'parent.first_name', label: 'Upline First Name', table: 'advisors', type: 'text', joinRequired: 'parent' },
  { key: 'parent.last_name', label: 'Upline Last Name', table: 'advisors', type: 'text', joinRequired: 'parent' },
];

const ENROLLMENTS_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'Enrollment ID', table: 'enrollments', type: 'text' },
  { key: 'enrollment_date', label: 'Enrollment Date', table: 'enrollments', type: 'date' },
  { key: 'effective_date', label: 'Effective Date', table: 'enrollments', type: 'date' },
  { key: 'termination_date', label: 'Termination Date', table: 'enrollments', type: 'date' },
  { key: 'status', label: 'Status', table: 'enrollments', type: 'status' },
  { key: 'monthly_premium', label: 'Monthly Premium', table: 'enrollments', type: 'currency' },
  { key: 'payment_frequency', label: 'Payment Frequency', table: 'enrollments', type: 'text' },
  { key: 'created_at', label: 'Created At', table: 'enrollments', type: 'datetime' },
  // Joined columns
  { key: 'member.first_name', label: 'Member First Name', table: 'members', type: 'text', joinRequired: 'member' },
  { key: 'member.last_name', label: 'Member Last Name', table: 'members', type: 'text', joinRequired: 'member' },
  { key: 'member.state', label: 'Member State', table: 'members', type: 'text', joinRequired: 'member' },
  { key: 'advisor.first_name', label: 'Advisor First Name', table: 'advisors', type: 'text', joinRequired: 'advisor' },
  { key: 'advisor.last_name', label: 'Advisor Last Name', table: 'advisors', type: 'text', joinRequired: 'advisor' },
  { key: 'product.name', label: 'Product Name', table: 'products', type: 'text', joinRequired: 'product' },
  { key: 'product.type', label: 'Product Type', table: 'products', type: 'text', joinRequired: 'product' },
  { key: 'product.is_addon', label: 'Is Add-On', table: 'products', type: 'boolean', joinRequired: 'product' },
];

const COMMISSIONS_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'Commission ID', table: 'commissions', type: 'text' },
  { key: 'commission_period', label: 'Commission Period', table: 'commissions', type: 'text' },
  { key: 'commission_type', label: 'Commission Type', table: 'commissions', type: 'text' },
  { key: 'amount', label: 'Amount', table: 'commissions', type: 'currency' },
  { key: 'rate', label: 'Rate', table: 'commissions', type: 'percent' },
  { key: 'status', label: 'Status', table: 'commissions', type: 'status' },
  { key: 'paid_at', label: 'Paid At', table: 'commissions', type: 'datetime' },
  { key: 'created_at', label: 'Created At', table: 'commissions', type: 'datetime' },
  // Joined columns
  { key: 'advisor.first_name', label: 'Advisor First Name', table: 'advisors', type: 'text', joinRequired: 'advisor' },
  { key: 'advisor.last_name', label: 'Advisor Last Name', table: 'advisors', type: 'text', joinRequired: 'advisor' },
  { key: 'advisor.code', label: 'Advisor Code', table: 'advisors', type: 'text', joinRequired: 'advisor' },
  { key: 'member.first_name', label: 'Member First Name', table: 'members', type: 'text', joinRequired: 'member' },
  { key: 'member.last_name', label: 'Member Last Name', table: 'members', type: 'text', joinRequired: 'member' },
];

// ============================================================================
// DATA SOURCE CONFIGURATIONS
// ============================================================================

export const DATA_SOURCE_CONFIGS: Record<DataSource, DataSourceConfig> = {
  members: {
    baseTable: 'members',
    alias: 'm',
    columns: MEMBERS_COLUMNS,
    joins: {
      advisor: {
        table: 'advisors',
        alias: 'a',
        on: 'm.advisor_id = a.id',
        type: 'LEFT',
      },
    },
  },
  advisors: {
    baseTable: 'advisors',
    alias: 'a',
    columns: ADVISORS_COLUMNS,
    joins: {
      level: {
        table: 'agent_levels',
        alias: 'al',
        on: 'a.agent_level_id = al.id',
        type: 'LEFT',
      },
      parent: {
        table: 'advisors',
        alias: 'pa',
        on: 'a.parent_advisor_id = pa.id',
        type: 'LEFT',
      },
    },
  },
  enrollments: {
    baseTable: 'enrollments',
    alias: 'e',
    columns: ENROLLMENTS_COLUMNS,
    joins: {
      member: {
        table: 'members',
        alias: 'm',
        on: 'e.member_id = m.id',
        type: 'LEFT',
      },
      advisor: {
        table: 'advisors',
        alias: 'a',
        on: 'e.advisor_id = a.id',
        type: 'LEFT',
      },
      product: {
        table: 'products',
        alias: 'p',
        on: 'e.product_id = p.id',
        type: 'LEFT',
      },
    },
  },
  commissions: {
    baseTable: 'commissions',
    alias: 'c',
    columns: COMMISSIONS_COLUMNS,
    joins: {
      advisor: {
        table: 'advisors',
        alias: 'a',
        on: 'c.advisor_id = a.id',
        type: 'LEFT',
      },
      member: {
        table: 'members',
        alias: 'm',
        on: 'c.member_id = m.id',
        type: 'LEFT',
      },
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getColumnsForDataSource(dataSource: DataSource): ColumnDefinition[] {
  return DATA_SOURCE_CONFIGS[dataSource]?.columns ?? [];
}

export function getColumnDefinition(
  dataSource: DataSource,
  columnKey: string
): ColumnDefinition | undefined {
  const config = DATA_SOURCE_CONFIGS[dataSource];
  if (!config) return undefined;
  return config.columns.find((col) => col.key === columnKey);
}

function getColumnAlias(dataSource: DataSource, columnKey: string): string {
  const config = DATA_SOURCE_CONFIGS[dataSource];
  if (!config) return columnKey;

  // Handle joined columns (e.g., "advisor.first_name")
  if (columnKey.includes('.')) {
    const [joinName, field] = columnKey.split('.');
    const join = config.joins[joinName];
    if (join) {
      return `${join.alias}.${field}`;
    }
  }

  // Base table column
  return `${config.alias}.${columnKey}`;
}

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value)) {
    return `(${value.map(escapeValue).join(', ')})`;
  }
  // Escape single quotes for strings
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ============================================================================
// QUERY BUILDER
// ============================================================================

export interface QueryBuilderResult {
  sql: string;
  countSql: string;
  params: Record<string, unknown>;
}

export function buildQuery(
  definition: ReportDefinition,
  orgId: string
): QueryBuilderResult {
  const { dataSource, columns, filters, grouping, aggregations, sorting, limit, offset } = definition;
  const config = DATA_SOURCE_CONFIGS[dataSource];

  if (!config) {
    throw new Error(`Unknown data source: ${dataSource}`);
  }

  // Determine required joins
  const requiredJoins = new Set<string>();
  const allColumns = [...columns, ...filters.map(f => f.column), ...grouping.map(g => g.column), ...aggregations.map(a => a.column)];

  for (const col of allColumns) {
    if (col.includes('.')) {
      const joinName = col.split('.')[0];
      if (config.joins[joinName]) {
        requiredJoins.add(joinName);
      }
    }
  }

  // Build SELECT clause
  let selectClauses: string[] = [];

  if (grouping.length > 0 && aggregations.length > 0) {
    // Grouped query with aggregations
    selectClauses = grouping.map((g) => {
      const alias = getColumnAlias(dataSource, g.column);
      const label = g.label || g.column.replace('.', '_');
      return `${alias} AS "${label}"`;
    });

    for (const agg of aggregations) {
      const alias = getColumnAlias(dataSource, agg.column);
      const aggLabel = agg.alias || `${agg.type}_${agg.column.replace('.', '_')}`;

      switch (agg.type) {
        case 'count':
          selectClauses.push(`COUNT(${alias}) AS "${aggLabel}"`);
          break;
        case 'count_distinct':
          selectClauses.push(`COUNT(DISTINCT ${alias}) AS "${aggLabel}"`);
          break;
        case 'sum':
          selectClauses.push(`SUM(${alias}) AS "${aggLabel}"`);
          break;
        case 'avg':
          selectClauses.push(`AVG(${alias}) AS "${aggLabel}"`);
          break;
        case 'min':
          selectClauses.push(`MIN(${alias}) AS "${aggLabel}"`);
          break;
        case 'max':
          selectClauses.push(`MAX(${alias}) AS "${aggLabel}"`);
          break;
      }
    }
  } else {
    // Regular query - select specified columns
    selectClauses = columns.map((col) => {
      const alias = getColumnAlias(dataSource, col);
      const label = col.replace('.', '_');
      return `${alias} AS "${label}"`;
    });
  }

  // Build FROM clause
  let fromClause = `${config.baseTable} ${config.alias}`;

  // Add required JOINs
  for (const joinName of requiredJoins) {
    const join = config.joins[joinName];
    if (join) {
      fromClause += `\n  ${join.type} JOIN ${join.table} ${join.alias} ON ${join.on}`;
    }
  }

  // Build WHERE clause
  const whereClauses: string[] = [`${config.alias}.org_id = '${orgId}'`];

  for (const filter of filters) {
    const columnAlias = getColumnAlias(dataSource, filter.column);
    const clause = buildFilterClause(columnAlias, filter);
    if (clause) {
      whereClauses.push(clause);
    }
  }

  const whereClause = whereClauses.join(' AND ');

  // Build GROUP BY clause
  let groupByClause = '';
  if (grouping.length > 0) {
    groupByClause = `GROUP BY ${grouping.map((g) => getColumnAlias(dataSource, g.column)).join(', ')}`;
  }

  // Build ORDER BY clause
  let orderByClause = '';
  if (sorting.length > 0) {
    const orderParts = sorting.map((s) => {
      const alias = getColumnAlias(dataSource, s.column);
      return `${alias} ${s.direction.toUpperCase()}`;
    });
    orderByClause = `ORDER BY ${orderParts.join(', ')}`;
  }

  // Build complete SQL
  const sql = [
    `SELECT ${selectClauses.join(', ')}`,
    `FROM ${fromClause}`,
    `WHERE ${whereClause}`,
    groupByClause,
    orderByClause,
    `LIMIT ${limit}`,
    `OFFSET ${offset}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Build count SQL
  const countSql = [
    grouping.length > 0
      ? `SELECT COUNT(*) FROM (SELECT 1 FROM ${fromClause} WHERE ${whereClause} ${groupByClause}) subq`
      : `SELECT COUNT(*) FROM ${fromClause} WHERE ${whereClause}`,
  ].join('\n');

  return {
    sql,
    countSql,
    params: {},
  };
}

function buildFilterClause(columnAlias: string, filter: Filter): string {
  const { operator, value, value2 } = filter;

  switch (operator) {
    case 'eq':
      return `${columnAlias} = ${escapeValue(value)}`;
    case 'neq':
      return `${columnAlias} != ${escapeValue(value)}`;
    case 'gt':
      return `${columnAlias} > ${escapeValue(value)}`;
    case 'gte':
      return `${columnAlias} >= ${escapeValue(value)}`;
    case 'lt':
      return `${columnAlias} < ${escapeValue(value)}`;
    case 'lte':
      return `${columnAlias} <= ${escapeValue(value)}`;
    case 'like':
    case 'ilike':
      return `${columnAlias} ILIKE ${escapeValue(`%${value}%`)}`;
    case 'starts_with':
      return `${columnAlias} ILIKE ${escapeValue(`${value}%`)}`;
    case 'ends_with':
      return `${columnAlias} ILIKE ${escapeValue(`%${value}`)}`;
    case 'in':
      if (Array.isArray(value)) {
        return `${columnAlias} IN ${escapeValue(value)}`;
      }
      return '';
    case 'nin':
      if (Array.isArray(value)) {
        return `${columnAlias} NOT IN ${escapeValue(value)}`;
      }
      return '';
    case 'is_null':
      return `${columnAlias} IS NULL`;
    case 'is_not_null':
      return `${columnAlias} IS NOT NULL`;
    case 'between':
      return `${columnAlias} BETWEEN ${escapeValue(value)} AND ${escapeValue(value2)}`;
    default:
      return '';
  }
}

// ============================================================================
// SUPABASE QUERY BUILDER
// ============================================================================

export interface SupabaseQueryParams {
  table: string;
  select: string;
  filters: Array<{
    column: string;
    operator: string;
    value: unknown;
  }>;
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  offset?: number;
}

export function buildSupabaseQuery(
  definition: ReportDefinition,
  orgId: string
): SupabaseQueryParams {
  const { dataSource, columns, filters, sorting, limit, offset } = definition;
  const config = DATA_SOURCE_CONFIGS[dataSource];

  if (!config) {
    throw new Error(`Unknown data source: ${dataSource}`);
  }

  // Build select string with joins
  const requiredJoins = new Set<string>();
  const selectParts: string[] = [];

  for (const col of columns) {
    if (col.includes('.')) {
      const [joinName, field] = col.split('.');
      if (config.joins[joinName]) {
        requiredJoins.add(joinName);
        selectParts.push(`${joinName}:${config.joins[joinName].table}(${field})`);
      }
    } else {
      selectParts.push(col);
    }
  }

  // Build filters for Supabase
  const supabaseFilters: SupabaseQueryParams['filters'] = [
    { column: 'org_id', operator: 'eq', value: orgId },
  ];

  for (const filter of filters) {
    // Handle joined column filters differently
    if (!filter.column.includes('.')) {
      supabaseFilters.push({
        column: filter.column,
        operator: mapOperatorToSupabase(filter.operator),
        value: filter.value,
      });
    }
  }

  return {
    table: config.baseTable,
    select: selectParts.join(', '),
    filters: supabaseFilters,
    orderBy: sorting.length > 0
      ? { column: sorting[0].column, ascending: sorting[0].direction === 'asc' }
      : undefined,
    limit,
    offset,
  };
}

function mapOperatorToSupabase(operator: string): string {
  const operatorMap: Record<string, string> = {
    eq: 'eq',
    neq: 'neq',
    gt: 'gt',
    gte: 'gte',
    lt: 'lt',
    lte: 'lte',
    like: 'ilike',
    ilike: 'ilike',
    in: 'in',
    is_null: 'is',
    is_not_null: 'not.is',
  };
  return operatorMap[operator] || 'eq';
}

// ============================================================================
// EXPORT FOR USE
// ============================================================================

export { DATA_SOURCES } from './types.js';
export type { DataSource, ColumnDefinition, Filter } from './types.js';
