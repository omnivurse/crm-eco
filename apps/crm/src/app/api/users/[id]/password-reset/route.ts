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
import { Resend } from 'resend';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { rateLimit, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    // Rate limit: 5 resets per user per hour
    const rl = rateLimit(`password_reset_${userId}`, { limit: 5, windowMs: 3600_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Try again later.' },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

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
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    let redirectTo = `${siteUrl}/update-password`;
    try {
      const body = await request.json();
      if (body.redirectTo && typeof body.redirectTo === 'string') {
        // Only allow relative paths or same-origin URLs to prevent open redirect
        if (body.redirectTo.startsWith('/') || body.redirectTo.startsWith(siteUrl)) {
          redirectTo = body.redirectTo;
        }
      }
    } catch {
      // No body provided, use default redirect
    }

    // Generate recovery link via admin API (does NOT send email)
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
        { error: 'Failed to generate password reset link' },
        { status: 500 }
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      console.error('[Users] No action_link in generateLink response');
      return NextResponse.json(
        { error: 'Failed to generate password reset link' },
        { status: 500 }
      );
    }

    // Send the password reset email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const fromName = process.env.RESEND_FROM_NAME || 'Pay It Forward Health';

    if (!resendApiKey || !fromEmail) {
      console.error('[Users] Missing RESEND_API_KEY or RESEND_FROM_EMAIL');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const userName = targetUser.full_name || email;

    const { error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [email],
      subject: 'Reset Your Password - Double Helix Hub',
      html: `<!doctype html>
<html>
  <body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <h1 style="margin:0;font-size:20px;">Reset Your Password</h1>
          <p style="margin:8px 0 0 0;font-size:14px;color:#475569;">Hi ${userName}, an administrator has requested a password reset for your account.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px 24px;">
          <p style="font-size:14px;color:#475569;margin:16px 0;">Click the button below to set a new password:</p>
          <a href="${actionLink}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">Reset Password</a>
          <p style="font-size:12px;color:#94a3b8;margin-top:16px;">This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
          <p style="font-size:11px;color:#cbd5e1;margin-top:12px;word-break:break-all;">Or copy this link: ${actionLink}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      text: `Reset Your Password\n\nHi ${userName}, an administrator has requested a password reset for your account.\n\nClick this link to set a new password: ${actionLink}\n\nThis link will expire in 1 hour. If you did not request this, you can safely ignore this email.`,
    });

    if (emailError) {
      console.error('[Users] Failed to send password reset email via Resend:', emailError);
      return NextResponse.json(
        { error: 'Password reset link generated but email delivery failed' },
        { status: 502 }
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
