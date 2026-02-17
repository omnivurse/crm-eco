/**
 * Admin Password Reset Email API Route
 * POST /api/users/[id]/password-reset - Send a password reset email to a user
 *
 * Uses the Supabase Admin API (service role key) to generate a password
 * reset link and send it to the target user's email.
 *
 * Only crm_admin users can trigger this.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(
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

    // Only crm_admin can send password resets
    if (currentProfile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Only CRM admins can reset passwords' }, { status: 403 });
    }

    // Get the target user profile (need their email via user_id)
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, organization_id, user_id, full_name, email')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Must be in the same organization
    if (targetUser.organization_id !== currentProfile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Cannot reset your own password via admin (use security settings)
    if (targetUser.id === currentProfile.id) {
      return NextResponse.json(
        { error: 'Use Security Settings to change your own password' },
        { status: 400 }
      );
    }

    // Use the Supabase admin client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[Users] Missing SUPABASE_SERVICE_ROLE_KEY for admin operations');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const adminClient = createServerClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get the user's email from auth
    const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(
      targetUser.user_id
    );

    if (authError || !authUser?.user?.email) {
      console.error('[Users] Failed to get auth user:', authError);
      return NextResponse.json({ error: 'Failed to find user email' }, { status: 500 });
    }

    const email = authUser.user.email;

    // Parse optional redirect URL from request body with open-redirect protection
    let redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin}/update-password`;
    try {
      const body = await request.json();
      if (body.redirectTo && typeof body.redirectTo === 'string') {
        // Only allow relative paths or same-origin URLs to prevent open redirect
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
        if (body.redirectTo.startsWith('/') || body.redirectTo.startsWith(siteUrl)) {
          redirectTo = body.redirectTo;
        }
      }
    } catch {
      // No body provided, use default redirect
    }

    // Generate and send password reset link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      console.error('[Users] Failed to generate reset link:', linkError);
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${email}`,
    });
  } catch (error) {
    console.error('[Users] Password reset error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send password reset' },
      { status: 500 }
    );
  }
}
