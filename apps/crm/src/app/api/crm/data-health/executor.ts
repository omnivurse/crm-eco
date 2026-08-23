/**
 * The Data Health sweep connection — the `SqlExecutor` the rule catalog runs on.
 *
 * WHY A DIRECT CONNECTION AND NOT THE POSTGREST CLIENT
 * The conduit reasoning is the duplicates route's (api/crm/duplicates/route.ts):
 * these rules join across `crm_records` at 16k rows, and under a user JWT the
 * security_invoker RLS predicates are re-evaluated inside every join — that is
 * what blew `statement_timeout` (57014) and 500ed the duplicates page in prod.
 * The sweep therefore runs with a role that is not subject to those policies.
 *
 * The catalog is *SQL* (`buildSql(orgId)` per rule), and PostgREST cannot
 * execute a statement — it can only reach tables, views, and declared RPCs.
 * v1 is not allowed to add a migration, so there is no RPC to call: the only
 * way to run the shared catalog verbatim is a Postgres connection. Every other
 * conduit guarantee is kept and enforced here:
 *
 *   - READ-ONLY BY CONSTRUCTION. `default_transaction_read_only=on` is set on
 *     the connection itself, so a stray write fails at the server (25006), not
 *     merely by convention. Every rule is a SELECT; nothing is persisted.
 *   - Org pinning is the caller's `profile.organization_id`, interpolated by
 *     `rules.ts` only after it validates as a literal UUID.
 *   - One connection, closed when the sweep ends; a statement timeout below the
 *     route's own budget so a pathological rule fails alone (into
 *     `report.errors`) instead of hanging the request.
 *
 * WHERE THE URL COMES FROM
 *   - `SUPABASE_DB_URL` when set (the name docs/PIFH_DEPLOY_SAFETY.md already
 *     uses for the Vercel projects' gate connection).
 *   - Otherwise, ONLY when the Supabase API URL is loopback — i.e. a developer
 *     running `supabase start` — the standard local stack DSN. This default can
 *     never point at production: it is gated on the API URL being 127.0.0.1.
 *   - Otherwise `null`: no live sweep. The route then falls back to the last
 *     recorded sweep (labelled as such) or fails closed. It never guesses.
 */

import postgres from 'postgres';
import type { SqlExecutor } from '@/lib/crm/data-health';

/** The DSN every `supabase start` stack ships with (local only, not a secret). */
export const LOCAL_SWEEP_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** Per-statement ceiling. One slow rule fails alone; the sweep still reports. */
export const SWEEP_STATEMENT_TIMEOUT_MS = 20_000;

const LOOPBACK_API_RE = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i;

/**
 * Resolve the read-only sweep DSN, or `null` when none is configured.
 * Pure over `env` so the fallback rules are unit-testable.
 */
export function resolveSweepDbUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.SUPABASE_DB_URL?.trim();
  if (explicit) return explicit;
  // Local stack only — never a guess against a hosted project.
  if (LOOPBACK_API_RE.test(env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '')) {
    return LOCAL_SWEEP_DB_URL;
  }
  return null;
}

/**
 * Open a read-only sweep connection, hand its executor to `fn`, and close it
 * again whether `fn` resolves or throws.
 */
export async function withSweepExecutor<T>(
  dbUrl: string,
  fn: (executor: SqlExecutor) => Promise<T>,
): Promise<T> {
  const sql = postgres(dbUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
    connection: {
      application_name: 'crm-data-health-sweep',
      statement_timeout: SWEEP_STATEMENT_TIMEOUT_MS,
      // Enforced by the server: the sweep cannot write even if a rule tried.
      default_transaction_read_only: true,
    },
  });
  try {
    return await fn(async (text) => {
      const rows = await sql.unsafe(text);
      return rows as unknown as Array<Record<string, unknown>>;
    });
  } finally {
    // Never let a teardown hiccup mask the sweep's own result.
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}
