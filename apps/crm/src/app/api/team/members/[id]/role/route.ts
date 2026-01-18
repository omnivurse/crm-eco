/**
 * Team Member Role Update API Route
 * PATCH /api/team/members/[id]/role - Update a team member's role
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

type UserRole = 'owner' | 'super_admin' | 'admin' | 'advisor' | 'staff';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  super_admin: 4,
  admin: 3,
  advisor: 2,
  staff: 1,
};

function getSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Ignore
          }
        },
      },
    }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await params;
    const supabase = getSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check permissions
    if (!['owner', 'super_admin', 'admin'].includes(currentProfile.role)) {
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

    // Cannot modify yourself
    if (targetMember.id === currentProfile.id) {
      return NextResponse.json({ error: 'Cannot modify your own role' }, { status: 400 });
    }

    // Parse new role
    const body = await request.json();
    const { role: newRole } = body as { role: UserRole };

    if (!newRole || !['super_admin', 'admin', 'advisor', 'staff'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Cannot change owner's role
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 403 });
    }

    // Cannot modify someone with higher or equal role (unless owner)
    const currentRoleLevel = ROLE_HIERARCHY[currentProfile.role as UserRole];
    const targetRoleLevel = ROLE_HIERARCHY[targetMember.role as UserRole];
    const newRoleLevel = ROLE_HIERARCHY[newRole];

    if (currentProfile.role !== 'owner' && targetRoleLevel >= currentRoleLevel) {
      return NextResponse.json({ error: 'Cannot modify user with equal or higher role' }, { status: 403 });
    }

    // Cannot assign a role higher than or equal to your own (unless owner)
    if (currentProfile.role !== 'owner' && newRoleLevel >= currentRoleLevel) {
      return NextResponse.json({ error: 'Cannot assign role equal to or higher than your own' }, { status: 403 });
    }

    // Only owner/super_admin can assign super_admin
    if (newRole === 'super_admin' && !['owner', 'super_admin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Cannot assign super admin role' }, { status: 403 });
    }

    // Update role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: newRole });
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update role' },
      { status: 500 }
    );
  }
}
