import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

/**
 * Create a typed Supabase browser client.
 *
 * Throws if the required environment variables are not set.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

