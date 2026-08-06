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
import {
  decideProfileAccess,
  membershipAllowsAccess,
} from './org-auth-policy.ts';

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

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('organization_id, role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  // A profile deactivation is global and must override any stale active tenant
  // membership. Session revocation is best-effort, so the live profile state is
  // the durable backstop for already-issued JWTs.
  if (profileError) return false;
  const profileDecision = decideProfileAccess(profile, organizationId, roles);
  if (profileDecision === 'deny') return false;
  if (profileDecision === 'allow') return true;

  // organization_members is keyed by auth user_id; it has no profile_id column.
  // Querying that nonexistent column made every secondary-tenant check error and
  // silently denied valid admins after they switched away from their home org.
  const { data: membership, error: membershipError } = await service
    .from('organization_members')
    .select('role, is_active')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  return !membershipError && membershipAllowsAccess(membership, roles);
}

/**
 * Roles permitted to move money or apply irreversible financial state.
 * Deliberately excludes `staff` and `read_only`.
 */
export const FINANCIAL_ROLES = ['owner', 'super_admin', 'admin'] as const;
