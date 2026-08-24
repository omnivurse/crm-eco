/**
 * Team Invitation API Route
 * POST /api/team/invite - Send a team invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import crypto from 'crypto';
import { sendTeamInviteEmail } from '@/lib/email/transactional';
import { rateLimitDurable, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';
import { canInviteOrgAdmin, canSendTeamInvite } from '@/lib/team/invite-access';

export const dynamic = 'force-dynamic';

type InvitableRole = 'admin' | 'advisor' | 'staff';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 20 invites per user per hour
    const rl = await rateLimitDurable(`team_invite_${profile.id}`, {
      limit: 20,
      windowSeconds: 3600,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many invitation requests. Try again later.' },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    if (!canSendTeamInvite(profile)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body as { email: string; role: InvitableRole };

    // Validate input
    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    // Validate role
    if (!['admin', 'advisor', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (role === 'admin' && !canInviteOrgAdmin(profile)) {
      return NextResponse.json({ error: 'Cannot invite admin role' }, { status: 403 });
    }

    // Check if email already exists in organization
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (existingProfile) {
      return NextResponse.json({ error: 'User already exists in this organization' }, { status: 400 });
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'Pending invitation already exists for this email' }, { status: 400 });
    }

    // Generate token and create invitation
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data: invitation, error: insertError } = await supabase
      .from('team_invitations')
      .insert({
        organization_id: profile.organization_id,
        email: email.toLowerCase(),
        role,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: profile.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating invitation:', insertError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
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
      toEmail: email.toLowerCase(),
      organizationName: org?.name || 'Your Organization',
      inviterName: inviterProfile?.full_name || inviterProfile?.email || 'A team member',
      role,
      inviteToken: token,
      expiresAt: expiresAt.toISOString(),
    });

    if (!emailResult.success) {
      console.warn(`Failed to send invite email to ${email}:`, emailResult.error);
      return NextResponse.json(
        {
          error: 'Invitation was saved but the email failed to send. Use Resend.',
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expires_at: invitation.expires_at,
          },
          emailSent: false,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
      emailSent: true,
    });
  } catch (error) {
    console.error('Team invite error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
