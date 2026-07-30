/**
 * Admin User Profile Update API Route
 * PATCH /api/users/[id]/profile - Update a user's profile details
 *
 * Allows admins to edit user details like name, status, etc.
 * Only crm_admin users can use this.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { logAuditEvent, AuditActions } from '@crm-eco/lib/audit';
import { revokeUserSessions } from '@/lib/security/revoke-sessions';

export const dynamic = 'force-dynamic';

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

    // Only crm_admin can edit user profiles
    if (currentProfile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Only CRM admins can edit user profiles' }, { status: 403 });
    }

    // Get the target user profile
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, organization_id, full_name, is_active, user_id')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Must be in the same organization
    if (targetUser.organization_id !== currentProfile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse update fields from request body
    const body = await request.json();

    // Whitelist allowed fields to prevent unintended updates
    const allowedFields: Record<string, unknown> = {};

    if (body.full_name !== undefined && typeof body.full_name === 'string') {
      const trimmed = body.full_name.trim();
      if (trimmed.length < 2) {
        return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
      }
      allowedFields.full_name = trimmed;
    }

    if (body.is_active !== undefined && typeof body.is_active === 'boolean') {
      // Cannot deactivate yourself
      if (targetUser.id === currentProfile.id && !body.is_active) {
        return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
      }
      allowedFields.is_active = body.is_active;
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update the profile
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        ...allowedFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, full_name, is_active, crm_role, email, avatar_url')
      .single();

    if (updateError) {
      console.error('[Users] Failed to update profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    const deactivated =
      allowedFields.is_active === false && targetUser.is_active !== false;
    const reactivated =
      allowedFields.is_active === true && targetUser.is_active !== true;

    // Only a deactivation ends sessions, and only because an admin just asked for
    // it. Renaming a user doesn't sign them out, and neither does elapsed time.
    const revocation = deactivated
      ? await revokeUserSessions(targetUser.user_id, 'account_deactivated')
      : null;

    await logAuditEvent({
      appSource: 'crm',
      action: deactivated
        ? AuditActions.USER_DEACTIVATED
        : reactivated
          ? AuditActions.USER_REACTIVATED
          : AuditActions.USER_UPDATED,
      actionCategory: 'data_modification',
      riskLevel: deactivated || reactivated ? 'high' : 'low',
      targetEntityType: 'profile',
      targetEntityId: targetUser.id,
      targetUserId: targetUser.user_id ?? undefined,
      description: deactivated
        ? `Deactivated ${targetUser.full_name ?? targetUser.id}`
        : reactivated
          ? `Reactivated ${targetUser.full_name ?? targetUser.id}`
          : `Updated profile for ${targetUser.full_name ?? targetUser.id}`,
      changes: {
        old: { full_name: targetUser.full_name, is_active: targetUser.is_active },
        new: allowedFields,
      },
      details: revocation
        ? {
            sessions_revoked: revocation.revoked,
            session_revocation_ok: revocation.ok,
          }
        : undefined,
    });

    return NextResponse.json({
      success: true,
      user: updated,
      ...(revocation ? { sessions_revoked: revocation.revoked } : {}),
    });
  } catch (error) {
    console.error('[Users] Update profile error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update profile' },
      { status: 500 }
    );
  }
}
