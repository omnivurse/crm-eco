/**
 * Transactional Email Service for CRM App
 * Sends system emails (invitations, notifications) using Resend
 *
 * Team invite emails are CRM-specific.
 * Enrollment/advisor notification emails are re-exported from shared package.
 */

import { Resend } from 'resend';

// Re-export shared transactional email functions
export {
  sendEnrollmentConfirmationEmail,
  sendAdvisorNotificationEmail,
  type TransactionalEmailResult,
} from '@crm-eco/lib/email';

// ============================================================================
// Configuration
// ============================================================================

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required for transactional emails');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@payitforward.app';
const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME || 'Pay It Forward';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================================================
// Types
// ============================================================================

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Team Invite Email Template
// ============================================================================

function getTeamInviteEmailHtml(params: {
  inviteeName: string;
  organizationName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
  expiresAt: string;
}): string {
  const { inviteeName, organizationName, inviterName, role, inviteLink, expiresAt } = params;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">You're Invited!</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Hi${inviteeName ? ` ${inviteeName}` : ''},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Click the button below to accept the invitation and set up your account.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #0d9488; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #71717a;">
                This invitation expires on <strong>${expiryDate}</strong>.
              </p>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #71717a;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #fafafa; border-radius: 0 0 12px 12px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #0d9488; word-break: break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>
        </table>

        <p style="margin: 20px 0 0; font-size: 12px; color: #a1a1aa;">
          &copy; ${new Date().getFullYear()} Pay It Forward. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function getTeamInviteEmailText(params: {
  inviteeName: string;
  organizationName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
  expiresAt: string;
}): string {
  const { inviteeName, organizationName, inviterName, role, inviteLink, expiresAt } = params;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
You're Invited to Join ${organizationName}!

Hi${inviteeName ? ` ${inviteeName}` : ''},

${inviterName} has invited you to join ${organizationName} as a ${role}.

Accept your invitation here:
${inviteLink}

This invitation expires on ${expiryDate}.

If you didn't expect this invitation, you can safely ignore this email.

---
Pay It Forward
`;
}

// ============================================================================
// Team Invite Email Function
// ============================================================================

/**
 * Send team invitation email
 */
export async function sendTeamInviteEmail(params: {
  toEmail: string;
  inviteeName?: string;
  organizationName: string;
  inviterName: string;
  role: string;
  inviteToken: string;
  expiresAt: string;
  fromEmail?: string;
  fromName?: string;
}): Promise<SendEmailResult> {
  const {
    toEmail,
    inviteeName = '',
    organizationName,
    inviterName,
    role,
    inviteToken,
    expiresAt,
    fromEmail = DEFAULT_FROM_EMAIL,
    fromName = DEFAULT_FROM_NAME,
  } = params;

  const inviteLink = `${APP_URL}/accept-invite?token=${inviteToken}`;

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject: `You're invited to join ${organizationName}`,
      html: getTeamInviteEmailHtml({
        inviteeName,
        organizationName,
        inviterName,
        role: formatRole(role),
        inviteLink,
        expiresAt,
      }),
      text: getTeamInviteEmailText({
        inviteeName,
        organizationName,
        inviterName,
        role: formatRole(role),
        inviteLink,
        expiresAt,
      }),
    });

    if (error) {
      console.error('Failed to send team invite email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending team invite email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    advisor: 'Advisor',
    staff: 'Staff Member',
    owner: 'Owner',
  };
  return roleMap[role] || role;
}
