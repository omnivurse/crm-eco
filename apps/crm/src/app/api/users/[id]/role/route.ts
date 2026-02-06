/**
 * CRM User Role Update API Route
 * PATCH /api/users/[id]/role - Update a user's CRM role
 *
 * Only crm_admin users can update CRM roles for other users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
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

    return NextResponse.json({
      success: true,
      crm_role: normalizedRole,
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
