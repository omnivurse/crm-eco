/**
 * Admin Email Change API Route
 * PUT /api/users/[id]/email - Directly change a user's email (admin override)
 *
 * Uses the Supabase Admin API (service role key) to update a user's email
 * immediately without requiring double-confirmation.
 *
 * Only admin/owner users can use this.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@supabase/supabase-js';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetProfileId } = await params;
    const supabase = await createClient();
    const currentProfile = await getAuthProfile();

    if (!currentProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin or owner can change emails
    if (currentProfile.role !== 'admin' && currentProfile.role !== 'owner') {
      return NextResponse.json({ error: 'Only admins and owners can change email addresses' }, { status: 403 });
    }

    // Get the target user profile
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, organization_id, user_id, full_name, email')
      .eq('id', targetProfileId)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Must be in the same organization
    if (targetUser.organization_id !== currentProfile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse new email from request body
    const body = await request.json();
    const { email } = body as { email: string };

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if email is already in use by another user
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', trimmedEmail)
      .neq('id', targetProfileId)
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'Email address is already in use' }, { status: 409 });
    }

    // Use the Supabase admin client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[Users] Missing SUPABASE_SERVICE_ROLE_KEY for admin operations');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminClient = createServerClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Update auth.users email via admin API (immediate, no confirmation needed)
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUser.user_id,
      { email: trimmedEmail, email_confirm: true }
    );

    if (updateError) {
      console.error('[Users] Failed to update email:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update email' },
        { status: 500 }
      );
    }

    // Update profiles table to stay in sync
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ email: trimmedEmail, updated_at: new Date().toISOString() })
      .eq('id', targetProfileId);

    if (profileError) {
      console.error('[Users] Failed to sync profile email:', profileError);
      // Auth email was already changed, so just warn
    }

    return NextResponse.json({
      success: true,
      message: `Email updated to ${trimmedEmail} for ${targetUser.full_name}`,
    });
  } catch (error) {
    console.error('[Users] Email change error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to change email' },
      { status: 500 }
    );
  }
}
