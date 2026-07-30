/**
 * Event-driven session revocation.
 *
 * Called only from privileged administrative actions — a CRM role change or an
 * account deactivation. This product has no inactivity timeout and no absolute
 * session lifetime: nothing here is ever triggered by elapsed time, and no job
 * schedules it. If you find yourself calling this from a timer, don't.
 *
 * Never throws. Revocation is a hardening step layered on top of RLS and the
 * middleware's live `profiles` lookup, both of which already deny a demoted or
 * deactivated user. Failing to revoke must not fail the role change itself.
 */

import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

/** Reason recorded alongside the revocation, for the audit trail. */
export type RevocationReason = 'role_changed' | 'account_deactivated';

export interface RevokeSessionsResult {
  ok: boolean;
  /** Sessions deleted. Zero is a normal result — the user may have none open. */
  revoked: number;
  error?: string;
}

/** Minimal client surface: `revoke_user_sessions` isn't in the generated types yet. */
interface RpcCapableClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * End every session belonging to one auth user.
 *
 * @param authUserId `profiles.user_id` — the auth.users id, not the profile id.
 *                   Passing a profile id here would silently revoke nothing.
 */
export async function revokeUserSessions(
  authUserId: string | null | undefined,
  reason: RevocationReason,
): Promise<RevokeSessionsResult> {
  if (!authUserId) {
    return { ok: false, revoked: 0, error: 'missing auth user id' };
  }

  try {
    const client = createServiceRoleClient() as unknown as RpcCapableClient;
    const { data, error } = await client.rpc('revoke_user_sessions', {
      p_user_id: authUserId,
    });

    if (error) {
      console.error(`[security] session revocation failed (${reason}):`, error.message);
      return { ok: false, revoked: 0, error: error.message };
    }

    return { ok: true, revoked: Number(data ?? 0) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[security] session revocation unavailable (${reason}):`, message);
    return { ok: false, revoked: 0, error: message };
  }
}
