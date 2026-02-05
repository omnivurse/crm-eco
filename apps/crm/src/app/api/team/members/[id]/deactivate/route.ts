/**
 * Team Member Deactivate API Route
 * POST /api/team/members/[id]/deactivate - Deactivate a team member
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type UserRole = 'owner' | 'super_admin' | 'admin' | 'advisor' | 'staff';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  super_admin: 4,
  admin: 3,
  advisor: 2,
  staff: 1,
};

export async function POST(
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

    // Check permissions
    if (!currentProfile.crm_role || !['owner', 'super_admin', 'admin'].includes(currentProfile.crm_role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get target member
    const { data: targetMember, error: memberError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Check member belongs to same org
    if (targetMember.organization_id !== currentProfile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Cannot deactivate yourself
    if (targetMember.id === currentProfile.id) {
      return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
    }

    // Cannot deactivate owner
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot deactivate organization owner' }, { status: 403 });
    }

    // Cannot deactivate someone with higher or equal role (unless owner)
    const currentRoleLevel = ROLE_HIERARCHY[currentProfile.crm_role as UserRole];
    const targetRoleLevel = ROLE_HIERARCHY[targetMember.role as UserRole];

    if (currentProfile.crm_role !== 'owner' && targetRoleLevel >= currentRoleLevel) {
      return NextResponse.json({ error: 'Cannot deactivate user with equal or higher role' }, { status: 403 });
    }

    // Deactivate member
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to deactivate member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deactivate member error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deactivate member' },
      { status: 500 }
    );
  }
}
