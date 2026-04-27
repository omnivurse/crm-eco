import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

const ENV_ERROR =
  'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set';

/**
 * Detect Next.js production build (`next build`).
 *
 * During SSG, Next pre-renders client components on the server to capture
 * their initial HTML. If env vars aren't set yet (e.g. on a fresh Vercel
 * preview before secrets are wired), throwing here would abort the entire
 * build. We instead return a lazy proxy so static markup still renders;
 * any real method call (which only happens at runtime in the browser) will
 * throw the same clear message.
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * Returns a no-op proxy that throws `ENV_ERROR` the first time anything
 * non-trivial is invoked on it. Method chains (`.from('x').select('*')`)
 * succeed up to the terminal `await`/Promise step, then reject.
 */
function buildTimeStub(): SupabaseClient<Database> {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'then') {
        return undefined;
      }
      return new Proxy(function stub() {
        throw new Error(ENV_ERROR);
      }, handler);
    },
    apply() {
      return new Proxy(function stub() {
        throw new Error(ENV_ERROR);
      }, handler);
    },
  };
  return new Proxy({}, handler) as unknown as SupabaseClient<Database>;
}

/**
 * Create a typed Supabase browser client.
 *
 * Throws at runtime if the required environment variables are not set.
 * During `next build` (SSG/ISR pre-render) the throw is deferred to the
 * first method call so the build can still complete.
 */
export function createClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isBuildPhase()) {
      return buildTimeStub();
    }
    throw new Error(ENV_ERROR);
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

