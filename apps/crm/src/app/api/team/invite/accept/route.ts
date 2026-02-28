import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthUser } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';

/**
 * GET /api/team/invite/accept?token=xxx
 * Validate an invitation token and return invitation details.
 * Works for both authenticated and unauthenticated users.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Use service role to read invitation (RLS may block unauthenticated users)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const serviceClient = createServerClient(supabaseUrl, serviceRoleKey, {
      cookies: { getAll() { return []; }, setAll() {} },
    });

    const { data: invitation, error } = await serviceClient
      .from('team_invitations')
      .select('id, email, role, status, expires_at, organization_id, organizations(name)')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation has already been ${invitation.status}` },
        { status: 410 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Check if user is authenticated
    const { user } = await getAuthUser();

    return NextResponse.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        organizationName: (invitation.organizations as unknown as { name: string })?.name || 'Unknown',
        expiresAt: invitation.expires_at,
      },
      isAuthenticated: !!user,
      emailMatch: user ? user.email?.toLowerCase() === invitation.email.toLowerCase() : null,
    });
  } catch (error) {
    console.error('[Invite] Error validating token:', error);
    return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
  }
}

/**
 * POST /api/team/invite/accept
 * Accept an invitation. Requires authenticated user whose email matches.
 * Body: { token: string, fullName: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { token, fullName } = await request.json();

    if (!token || !fullName?.trim()) {
      return NextResponse.json(
        { error: 'Token and full name are required' },
        { status: 400 }
      );
    }

    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Call the DB function that validates and creates the profile
    const { data: profileId, error } = await (supabase as any).rpc('accept_team_invitation', {
      p_token: token,
      p_full_name: fullName.trim(),
    });

    if (error) {
      console.error('[Invite] accept_team_invitation error:', error);
      const message = error.message || 'Failed to accept invitation';
      const status = message.includes('not authenticated') ? 401
        : message.includes('expired') || message.includes('Invalid') ? 410
        : message.includes('different email') ? 403
        : message.includes('already has a profile') ? 409
        : 500;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      success: true,
      profileId,
    });
  } catch (error) {
    console.error('[Invite] Error accepting invitation:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
