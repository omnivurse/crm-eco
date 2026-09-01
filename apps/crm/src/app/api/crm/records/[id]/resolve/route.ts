/**
 * GET /api/crm/records/:id/resolve
 *
 * Tiny helper used by the client-side edit page when the initial record
 * fetch returns nothing. Tells the UI whether to 404, redirect to a
 * merged keeper, or offer a search fallback.
 *
 * - 200 { kind: 'found',   id }                             → visible to this user
 * - 200 { kind: 'merged',  keeperId, keeperTitle, mergedAt } → hop to the keeper
 * - 200 { kind: 'missing' }                                  → show the 404 UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, getAuthUser } from '@/lib/supabase-server';
import { resolveRecordOrMergeDestination } from '@/lib/crm/resolve-record';
import { getActiveTenant } from '@/lib/tenant';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Match the CRM shell: organization_members can grant access even when the
  // legacy profiles.crm_role field is empty, including for the home tenant.
  const activeTenant = profile.crm_role ? null : await getActiveTenant();
  const admittedViaTenant =
    activeTenant !== null &&
    ['owner', 'super_admin', 'admin', 'staff'].includes(activeTenant.role);
  if (!profile.crm_role && !admittedViaTenant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await resolveRecordOrMergeDestination(id, profile.organization_id);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[resolve-record] error:', err);
    // Fail soft — the calling page will render not-found.
    return NextResponse.json({ kind: 'missing' }, { status: 200 });
  }
}
