import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

const ENV_ERROR =
  'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set';

/**
 * Returns a lazy no-op proxy so configuration-error UI can render without
 * constructing a client from invalid values. No provider request can escape
 * this proxy.
 */
function missingEnvStub(): SupabaseClient<Database> {
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
 * When configuration is missing, construction stays lazy so Next.js can render
 * a public configuration-error page during both builds and runtime SSR. Any
 * real Supabase operation still fails closed through the stub.
 */
export function createClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return missingEnvStub();
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

