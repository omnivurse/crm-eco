import { NextRequest } from 'next/server';
import { vi } from 'vitest';

/**
 * Build a NextRequest for testing API routes.
 */
export function buildRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): NextRequest {
  const { method = 'GET', body, headers = {} } = options ?? {};
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

/**
 * Create a mock Supabase query builder with fluent chaining.
 * Every chainable method returns `this` and the terminal method
 * (`single`, `then`, etc.) resolves with the configured data/error.
 */
export function buildQueryBuilder(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'is', 'in', 'not', 'or', 'and', 'filter',
    'order', 'limit', 'range', 'offset',
    'match', 'textSearch', 'contains', 'containedBy',
    'overlaps', 'csv',
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  // Terminal methods
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = vi.fn((resolve: Function) => resolve(result));
  // Allow direct await (thenable)
  (builder as any)[Symbol.toStringTag] = 'Promise';

  return builder;
}

/**
 * Build a mock Supabase client.
 * `tables` maps table names to their query results.
 * `rpcResults` maps function names to their results.
 */
export function buildSupabaseClient(
  tables: Record<string, { data?: unknown; error?: unknown; count?: number | null }> = {},
  options?: {
    rpcResults?: Record<string, { data?: unknown; error?: unknown }>;
    authUser?: { id: string; email: string } | null;
  }
) {
  const queryBuilders: Record<string, ReturnType<typeof buildQueryBuilder>> = {};
  for (const [table, result] of Object.entries(tables)) {
    queryBuilders[table] = buildQueryBuilder(result);
  }

  // Default fallback builder
  const defaultBuilder = buildQueryBuilder({ data: null, error: null });

  const client = {
    from: vi.fn((table: string) => queryBuilders[table] ?? defaultBuilder),
    rpc: vi.fn((fn: string, args?: unknown) => {
      const result = options?.rpcResults?.[fn] ?? { data: null, error: null };
      return Promise.resolve(result);
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: options?.authUser ?? null },
          error: options?.authUser ? null : { message: 'Not authenticated' },
        })
      ),
    },
  };

  return { client, queryBuilders };
}

/**
 * Build a standard test profile.
 */
export function buildProfile(overrides?: Partial<{
  id: string;
  user_id: string;
  organization_id: string;
  crm_role: string;
  full_name: string;
  email: string;
}>) {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    organization_id: 'org-1',
    crm_role: 'crm_admin',
    full_name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  };
}
