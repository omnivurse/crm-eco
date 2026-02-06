/**
 * Admin Set Password API Route
 * PUT /api/users/[id]/password - Directly set a user's password (admin override)
 *
 * Uses the Supabase Admin API (service role key) to update a user's password
 * without requiring their current password.
 *
 * Only crm_admin users can use this.
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
    const { id: userId } = await params;
    const supabase = await createClient();
    const currentProfile = await getAuthProfile();

    if (!currentProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only crm_admin can set passwords
    if (currentProfile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Only CRM admins can set passwords' }, { status: 403 });
    }

    // Get the target user profile
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, organization_id, user_id, full_name')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Must be in the same organization
    if (targetUser.organization_id !== currentProfile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Cannot set your own password via admin (use security settings)
    if (targetUser.id === currentProfile.id) {
      return NextResponse.json(
        { error: 'Use Security Settings to change your own password' },
        { status: 400 }
      );
    }

    // Parse new password from request body
    const body = await request.json();
    const { password } = body as { password: string };

    if (!password || password.length < 12) {
      return NextResponse.json(
        { error: 'Password must be at least 12 characters' },
        { status: 400 }
      );
    }

    // Validate password complexity
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
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

    // Update the user's password via admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUser.user_id,
      { password }
    );

    if (updateError) {
      console.error('[Users] Failed to set password:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to set password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password updated for ${targetUser.full_name}`,
    });
  } catch (error) {
    console.error('[Users] Set password error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set password' },
      { status: 500 }
    );
  }
}
