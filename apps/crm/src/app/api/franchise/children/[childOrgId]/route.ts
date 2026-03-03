import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/franchise/children/[childOrgId]
 *
 * Revoke a franchise relationship (terminates + revokes delegations).
 * Owner only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ childOrgId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Only org owners can revoke franchise relationships' }, { status: 403 });
    }

    const { childOrgId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('revoke_franchise_relationship', {
      p_parent_org_id: profile.organization_id,
      p_child_org_id: childOrgId,
    });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error revoking franchise relationship:', error);
    return NextResponse.json({ error: 'Failed to revoke franchise relationship' }, { status: 500 });
  }
}
