import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Gate on the ACTIVE org's effective CRM role via `has_crm_role` RPC.
 * Do not use `profile.crm_role` after tenant switch — that value stays on the
 * home org (see trash route comment).
 */
export async function requireActiveOrgCrmRoles(
  supabase: SupabaseClient,
  orgId: string,
  roles: string[],
): Promise<{ ok: true } | { ok: false; status: 403; error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allowed, error } = await (supabase as any).rpc('has_crm_role', {
    p_org_id: orgId,
    p_roles: roles,
  });

  if (error || !allowed) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true };
}
