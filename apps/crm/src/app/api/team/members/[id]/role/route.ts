/**
 * Team Member Role Update API Route
 * PATCH /api/team/members/[id]/role - Update a team member's organization role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  canManageTeamMembers,
  effectiveOrgRole,
  orgRoleLevel,
} from '@/lib/team/invite-access';

export const dynamic = 'force-dynamic';

type UserRole = 'owner' | 'super_admin' | 'admin' | 'advisor' | 'staff';

export async function PATCH(
  request: NextRequest,
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
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (targetMember.organization_id !== currentProfile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (targetMember.id === currentProfile.id) {
      return NextResponse.json({ error: 'Cannot modify your own role' }, { status: 400 });
    }

    const body = await request.json();
    const { role: newRole } = body as { role: UserRole };

    if (!newRole || !['super_admin', 'admin', 'advisor', 'staff'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 403 });
    }

    const actorRole = effectiveOrgRole(currentProfile);
    const currentRoleLevel = orgRoleLevel(actorRole);
    const targetRoleLevel = orgRoleLevel(targetMember.role);
    const newRoleLevel = orgRoleLevel(newRole);

    if (actorRole !== 'owner' && targetRoleLevel >= currentRoleLevel) {
      return NextResponse.json({ error: 'Cannot modify user with equal or higher role' }, { status: 403 });
    }

    if (actorRole !== 'owner' && newRoleLevel >= currentRoleLevel) {
      return NextResponse.json({ error: 'Cannot assign role equal to or higher than your own' }, { status: 403 });
    }

    if (newRole === 'super_admin' && !['owner', 'super_admin'].includes(actorRole)) {
      return NextResponse.json({ error: 'Cannot assign super admin role' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: newRole });
  } catch (error) {
    console.error('[team/members/role]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
