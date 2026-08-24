/**
 * Resend Team Invitation API Route
 * POST /api/team/invite/[id]/resend - Resend an invitation email
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import crypto from 'crypto';
import { sendTeamInviteEmail } from '@/lib/email/transactional';
import { canSendTeamInvite } from '@/lib/team/invite-access';

export const dynamic = 'force-dynamic';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(
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

    if (!canSendTeamInvite(profile)) {
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

    // Check invitation is still pending
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 400 });
    }

    // Generate new token and extend expiration
    const newToken = generateToken();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 });
    }

    // Get organization name and inviter info for email
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .single();

    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', profile.id)
      .single();

    // Send invitation email
    const emailResult = await sendTeamInviteEmail({
      toEmail: invitation.email,
      organizationName: org?.name || 'Your Organization',
      inviterName: inviterProfile?.full_name || inviterProfile?.email || 'A team member',
      role: invitation.role,
      inviteToken: newToken,
      expiresAt: newExpiresAt.toISOString(),
    });

    if (!emailResult.success) {
      console.warn(`Failed to resend invite email to ${invitation.email}:`, emailResult.error);
      return NextResponse.json(
        {
          error: 'Invitation was updated but the email failed to send. Try Resend again.',
          emailSent: false,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      expires_at: newExpiresAt.toISOString(),
      emailSent: true,
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resend invitation' },
      { status: 500 }
    );
  }
}
