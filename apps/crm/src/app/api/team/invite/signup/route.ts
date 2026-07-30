/**
 * Invited User Signup API Route
 * POST /api/team/invite/signup
 *
 * Creates a new auth user via the Supabase Admin API for invited users.
 * This bypasses the enable_signup=false restriction, since the user
 * has a valid invitation token proving they were invited.
 *
 * After creating the user, it signs them in and returns the session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { rateLimitDurable, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Rate limit: 5 signup attempts per IP per hour
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rl = await rateLimitDurable(`invite_signup_${ip}`, {
      limit: 5,
      windowSeconds: 3600,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Try again later.' },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Validate the invitation token using service role
    const serviceClient = createServerClient(supabaseUrl, serviceRoleKey, {
      cookies: { getAll() { return []; }, setAll() {} },
    });

    const { data: invitation, error: inviteError } = await serviceClient
      .from('team_invitations')
      .select('id, email, role, status, expires_at, organization_id')
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
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

    // Create the user via Admin API (bypasses enable_signup=false)
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true, // Auto-confirm since they have a valid invite
    });

    if (createError) {
      // If user already exists, tell them to sign in instead
      if (createError.message?.includes('already been registered') ||
          createError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.' },
          { status: 409 }
        );
      }
      console.error('[Invite Signup] Failed to create user:', createError);
      return NextResponse.json(
        { error: createError.message || 'Failed to create account' },
        { status: 400 }
      );
    }

    if (!newUser?.user) {
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    // Sign the user in to get a session
    const { data: signInData, error: signInError } = await adminClient.auth.signInWithPassword({
      email: invitation.email,
      password,
    });

    if (signInError || !signInData?.session) {
      // User was created but sign-in failed — they can still sign in manually
      return NextResponse.json({
        success: true,
        needsSignIn: true,
        message: 'Account created. Please sign in with your credentials.',
      });
    }

    return NextResponse.json({
      success: true,
      needsSignIn: false,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });
  } catch (error) {
    console.error('[Invite Signup] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create account' },
      { status: 500 }
    );
  }
}
