/**
 * CRM User Role Update API Route
 * PATCH /api/users/[id]/role - Update a user's CRM role
 *
 * Only crm_admin users can update CRM roles for other users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { requireActiveOrgCrmRoles } from '@/lib/crm/require-crm-role';
import { logAuditEvent, AuditActions } from '@crm-eco/lib/audit';
import { revokeUserSessions } from '@/lib/security/revoke-sessions';
import type { CrmRole } from '@/lib/crm/types';

export const dynamic = 'force-dynamic';

const VALID_CRM_ROLES: (CrmRole | null)[] = [
  'crm_admin',
  'crm_manager',
  'crm_agent',
  'crm_viewer',
  null, // Remove CRM access
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();
    const currentProfile = await getAuthProfile();

    if (!currentProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only crm_admin can manage CRM roles
    if (currentProfile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Only CRM admins can manage roles' }, { status: 403 });
    }

    // Defense in depth. The check above reads the profile role, which
    // getAuthProfile now downgrades to the ACTIVE org's rights — but this
    // handler escalates to a service-role client below, so RLS is NOT a
    // backstop. Re-assert against the database (has_crm_role) so a stale role
    // can never be the only thing between a caller and role escalation inside a
    // tenant they merely belong to.
    const activeOrgGate = await requireActiveOrgCrmRoles(
      supabase,
      currentProfile.organization_id,
      ['crm_admin'],
    );
    if (!activeOrgGate.ok) {
      return NextResponse.json({ error: activeOrgGate.error }, { status: activeOrgGate.status });
    }

    // Get the target user profile
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, organization_id, crm_role, full_name, user_id')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Must be in the same organization
    if (targetUser.organization_id !== currentProfile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Cannot modify your own CRM role
    if (targetUser.id === currentProfile.id) {
      return NextResponse.json({ error: 'Cannot modify your own CRM role' }, { status: 400 });
    }

    // Parse new role from request body
    const body = await request.json();
    const newRole = body.crm_role as CrmRole | null | '';

    // Normalize empty string to null (remove access)
    const normalizedRole = newRole === '' ? null : newRole;

    if (!VALID_CRM_ROLES.includes(normalizedRole)) {
      return NextResponse.json({ error: 'Invalid CRM role' }, { status: 400 });
    }

    // Update the CRM role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        crm_role: normalizedRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[Users] Failed to update CRM role:', updateError);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    // End the target's sessions so a demotion or revocation can't be ridden out on
    // an already-issued token. Triggered by this admin action only — never by
    // inactivity or elapsed time. Best-effort: the role change has already
    // committed, and RLS plus the middleware profile lookup enforce the new role
    // regardless, so a revocation failure must not turn into a 500.
    const revocation = await revokeUserSessions(targetUser.user_id, 'role_changed');

    await logAuditEvent({
      appSource: 'crm',
      action: AuditActions.ROLE_CHANGED,
      actionCategory: 'authorization',
      riskLevel: 'high',
      targetEntityType: 'profile',
      targetEntityId: targetUser.id,
      targetUserId: targetUser.user_id ?? undefined,
      description: normalizedRole
        ? `CRM role changed to ${normalizedRole} for ${targetUser.full_name ?? targetUser.id}`
        : `CRM access removed from ${targetUser.full_name ?? targetUser.id}`,
      changes: {
        old: { crm_role: targetUser.crm_role },
        new: { crm_role: normalizedRole },
      },
      details: {
        sessions_revoked: revocation.revoked,
        session_revocation_ok: revocation.ok,
      },
    });

    return NextResponse.json({
      success: true,
      crm_role: normalizedRole,
      sessions_revoked: revocation.revoked,
      message: normalizedRole
        ? `CRM role updated to ${normalizedRole}`
        : 'CRM access removed',
    });
  } catch (error) {
    console.error('[Users] Update role error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update role' },
      { status: 500 }
    );
  }
}
