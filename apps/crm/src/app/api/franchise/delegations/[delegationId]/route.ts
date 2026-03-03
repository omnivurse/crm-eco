import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/franchise/delegations/[delegationId]
 *
 * Update delegation permissions. Owner only.
 * Body: { permissions }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ delegationId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Only org owners can update delegations' }, { status: 403 });
    }

    const { delegationId } = await params;
    const body = await request.json();
    const supabase = await createClient();

    if (!body.permissions) {
      return NextResponse.json({ error: 'permissions object is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('update_delegation_permissions', {
      p_delegation_id: delegationId,
      p_permissions: body.permissions,
    });

    if (error) {
      if (error.message?.includes('FORBIDDEN')) {
        return NextResponse.json({ error: 'Raw record access cannot be granted' }, { status: 403 });
      }
      if (error.message?.includes('DELEGATION_NOT_FOUND')) {
        return NextResponse.json({ error: 'Delegation not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating delegation:', error);
    return NextResponse.json({ error: 'Failed to update delegation' }, { status: 500 });
  }
}

/**
 * DELETE /api/franchise/delegations/[delegationId]
 *
 * Revoke a specific delegation. Owner only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ delegationId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Only org owners can revoke delegations' }, { status: 403 });
    }

    const { delegationId } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('org_delegations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', delegationId)
      .eq('parent_org_id', profile.organization_id);

    if (error) throw error;

    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error('Error revoking delegation:', error);
    return NextResponse.json({ error: 'Failed to revoke delegation' }, { status: 500 });
  }
}
