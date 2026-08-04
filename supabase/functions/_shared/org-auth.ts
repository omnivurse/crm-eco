/**
 * Shared fail-closed org authorization for edge functions.
 *
 * Extracted verbatim from `apply-price-change/index.ts`, which was the only
 * function in the repo that got this right. Several others construct a
 * service-role client (bypassing RLS entirely) and then act on a client-supplied
 * id without ever inspecting the caller.
 *
 * IMPORTANT: the platform's `verify_jwt` gate is NOT authorization. Supabase
 * accepts any JWT signed by the project — including the anon key, which ships in
 * every browser bundle. A function that relies on `verify_jwt` alone is
 * effectively public.
 *
 * Two accepted lanes:
 *   1. Internal — service-role bearer or CRON_SECRET (see `cron-auth.ts`).
 *   2. A user JWT whose profile org, or active organization_members row, matches
 *      the organization being acted on.
 *
 * Always resolve `organizationId` from the target ROW (look the record up first),
 * never from the request body — otherwise the check is circular.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeInternalEdgeRequest } from './cron-auth.ts';

type ServiceClient = ReturnType<typeof createClient>;

export interface OrgAccessOptions {
  /**
   * When set, the caller's role in that organization must be one of these.
   * Omit to allow any member (the historical apply-price-change behaviour).
   */
  requiredRoles?: string[];
}

export async function callerMayAccessOrg(
  service: ServiceClient,
  req: Request,
  organizationId: string,
  opts: OrgAccessOptions = {},
): Promise<boolean> {
  if (!organizationId) return false;

  // Lane 1: internal caller (cron / server-to-server). Trusted, no role check.
  if (authorizeInternalEdgeRequest(req)) return true;

  // Lane 2: a real end-user JWT.
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) return false;

  const roles = opts.requiredRoles;

  const { data: profile } = await service
    .from('profiles')
    .select('id, organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.organization_id === organizationId) {
    if (!roles) return true;
    if (typeof profile.role === 'string' && roles.includes(profile.role)) return true;
    // Fall through: the membership row may carry a higher role than the profile.
  }

  if (profile?.id) {
    const { data: membership } = await service
      .from('organization_members')
      .select('id, role, is_active')
      .eq('organization_id', organizationId)
      .or(`user_id.eq.${user.id},profile_id.eq.${profile.id}`)
      .limit(1)
      .maybeSingle();

    if (membership && membership.is_active !== false) {
      if (!roles) return true;
      if (typeof membership.role === 'string' && roles.includes(membership.role)) return true;
    }
  }

  return false;
}

/**
 * Roles permitted to move money or apply irreversible financial state.
 * Deliberately excludes `staff` and `read_only`.
 */
export const FINANCIAL_ROLES = ['owner', 'super_admin', 'admin'] as const;
