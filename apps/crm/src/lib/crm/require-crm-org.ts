/**
 * CRM API org context — explicit tenant guard for money/PHI routes.
 * Complements RLS; use before service-role calls that bypass session policies.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthProfile } from '@/lib/supabase-server';

export type CrmOrgContext =
  | { ok: true; profile: NonNullable<Awaited<ReturnType<typeof getAuthProfile>>>; orgId: string }
  | { ok: false; status: 401 | 403; error: string };

/** Require authenticated CRM user with a resolved organization. */
export async function requireCrmOrgContext(): Promise<CrmOrgContext> {
  const profile = await getAuthProfile();
  if (!profile) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const orgId = profile.organization_id;
  if (!orgId) {
    return { ok: false, status: 403, error: 'No organization context' };
  }

  return { ok: true, profile, orgId };
}

/** Verify a commission payment batch belongs to the caller's org (session client). */
export async function assertCommissionBatchOrgAccess(
  supabase: SupabaseClient,
  batchId: string,
  orgId: string,
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const { data, error } = await supabase
    .from('commission_payment_batches')
    .select('id, organization_id')
    .eq('id', batchId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 404, error: 'Batch not found' };
  }

  if (data.organization_id !== orgId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true };
}
