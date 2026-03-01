/**
 * Team Invitation Management API Route
 * DELETE /api/team/invite/[id] - Revoke an invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invitationId } = await params;
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions using org-level role
    if (!profile.role || !['owner', 'super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check invitation belongs to user's org
    if (invitation.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Revoke the invitation
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke invitation' },
      { status: 500 }
    );
  }
}
