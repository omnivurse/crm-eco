/**
 * Connection helper for Layer 2/3 enrollment DB tests.
 *
 * Reads a STAGING Supabase from the environment. No connection is made at
 * import time — `getTestClient()` is only called from inside guarded specs,
 * so importing this module is always side-effect free. NEVER set these to a
 * production project: the DB specs create/mutate rows.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const TEST_DB_URL = process.env.SUPABASE_TEST_URL;
export const TEST_DB_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

/** True only when a staging DB is configured. Guards every DB suite. */
export const hasTestDb = Boolean(TEST_DB_URL && TEST_DB_KEY);

let cached: SupabaseClient | null = null;

export function getTestClient(): SupabaseClient {
  if (!hasTestDb) {
    throw new Error(
      'SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_ROLE_KEY are not set — point them at a STAGING project, never production.'
    );
  }
  if (!cached) {
    cached = createClient(TEST_DB_URL as string, TEST_DB_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
