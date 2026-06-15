/**
 * Optional service-role client for lead conversion post-steps (repair, indexed sync).
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is missing or invalid — conversion RPC
 * uses the staff session client instead.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

export function tryCreateLeadConversionAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}
