/**
 * Team Member Reactivate API Route
 * POST /api/team/members/[id]/reactivate - Reactivate a team member
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  canManageTeamMembers,
  effectiveOrgRole,
  orgRoleLevel,
} from '@/lib/team/invite-access';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const supabase = await createClient();
    const currentProfile = await getAuthProfile();
    if (!currentProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageTeamMembers(currentProfile)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { data: targetMember, error: memberError } = await supabase
      .from('profiles')
      .select('id, organization_id, role, is_active')
      .eq('id', memberId)
      .single();

    if (memberError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (targetMember.organization_id !== currentProfile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const actorRole = effectiveOrgRole(currentProfile);
    const currentRoleLevel = orgRoleLevel(actorRole);
    const targetRoleLevel = orgRoleLevel(targetMember.role);

    // Reactivation restores every permission attached to the target's org role.
    // Apply the same hierarchy used by deactivate and role-change operations.
    if (actorRole !== 'owner' && targetRoleLevel >= currentRoleLevel) {
      return NextResponse.json({ error: 'Cannot reactivate user with equal or higher role' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to reactivate member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reactivate member error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reactivate member' },
      { status: 500 }
    );
  }
}
