import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Internal Double Helix tenant — provisioned by
// supabase/migrations/202605080008_double_helix_internal_tenant.sql
export const DOUBLE_HELIX_ORG_ID = '00000000-d0d0-4000-8000-000000000001';
export const DOUBLE_HELIX_LEADS_MODULE_ID = '00000000-d0d0-4000-8000-000000000002';

let cached: SupabaseClient | null = null;

/**
 * Server-only service-role Supabase client. Used by the public lead-capture
 * endpoint to insert into crm_records under the Double Helix internal org.
 * Bypasses RLS by design — never call from client code.
 */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
