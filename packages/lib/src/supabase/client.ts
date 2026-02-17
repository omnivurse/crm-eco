import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

/**
 * Create a typed Supabase browser client.
 *
 * Uses placeholder values when env vars are missing (e.g. during
 * Next.js static page generation at build time). The client will
 * be non-functional but won't crash the build. At runtime in the
 * browser the real env vars are always present.
 */
export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

