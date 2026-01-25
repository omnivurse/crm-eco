/**
 * Transactional Email Service
 * Sends system emails (invitations, notifications) using Resend
 * This uses the system RESEND_API_KEY, not integration connections
 */

import { Resend } from 'resend';

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

export interface TransactionalEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Email Templates
// ============================================================================

function getEnrollmentConfirmationHtml(params: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  planName?: string;
  enrollmentId: string;
  organizationName: string;
}): string {
  const { firstName, lastName, email, phone, planName, enrollmentId, organizationName } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enrollment Received - ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <div style="width: 60px; height: 60px; background-color: #d1fae5; border-radius: 50%; margin: 0 auto 20px; line-height: 60px; text-align: center;">
                <span style="font-size: 28px;">✓</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">Enrollment Received!</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Hi ${firstName},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Thank you for submitting your enrollment with <strong>${organizationName}</strong>. We've received your information and our team will be in touch shortly.
              </p>

              <!-- Enrollment Details -->
              <div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px; font-size: 14px; font-weight: 600; color: #71717a; text-transform: uppercase;">Enrollment Details</h3>
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Reference ID:</td>
                    <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right; font-weight: 500;">${enrollmentId.slice(0, 8).toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Name:</td>
                    <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right;">${firstName} ${lastName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Email:</td>
                    <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Phone:</td>
                    <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right;">${phone}</td>
                  </tr>
                  ${planName ? `
                  <tr>
                    <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Plan:</td>
                    <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right;">${planName}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #71717a;">
                <strong>What's next?</strong> An advisor will review your enrollment and contact you within 1-2 business days to discuss your options and answer any questions.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #fafafa; border-radius: 0 0 12px 12px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                Questions? Reply to this email or contact your advisor directly.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin: 20px 0 0; font-size: 12px; color: #a1a1aa;">
          &copy; ${new Date().getFullYear()} ${organizationName}. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function getAdvisorNotificationHtml(params: {
  advisorName: string;
  memberFirstName: string;
  memberLastName: string;
  memberEmail: string;
  memberPhone: string;
  enrollmentId: string;
  organizationName: string;
  crmLink: string;
}): string {
  const { advisorName, memberFirstName, memberLastName, memberEmail, memberPhone, enrollmentId, organizationName, crmLink } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Enrollment Received - ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <div style="width: 60px; height: 60px; background-color: #dbeafe; border-radius: 50%; margin: 0 auto 20px; line-height: 60px; text-align: center;">
                <span style="font-size: 28px;">📋</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">New Enrollment Assigned</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Hi ${advisorName},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                A new enrollment has been assigned to you and requires your attention.
              </p>

              <!-- Member Details -->
              <div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px; font-size: 14px; font-weight: 600; color: #71717a; text-transform: uppercase;">Member Information</h3>
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Name:</td>
                    <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right; font-weight: 500;">${memberFirstName} ${memberLastName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Email:</td>
                    <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right;">
                      <a href="mailto:${memberEmail}" style="color: #0d9488;">${memberEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Phone:</td>
                    <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right;">
                      <a href="tel:${memberPhone}" style="color: #0d9488;">${memberPhone}</a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${crmLink}" style="display: inline-block; padding: 14px 32px; background-color: #0d9488; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                      View Enrollment
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #71717a;">
                Please review and contact this member within 1-2 business days.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #fafafa; border-radius: 0 0 12px 12px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                Reference ID: ${enrollmentId.slice(0, 8).toUpperCase()}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ============================================================================
// Email Sending Functions
// ============================================================================

/**
 * Send enrollment confirmation email to member
 */
export async function sendEnrollmentConfirmationEmail(params: {
  toEmail: string;
  firstName: string;
  lastName: string;
  phone: string;
  planName?: string;
  enrollmentId: string;
  organizationName: string;
  fromEmail?: string;
  fromName?: string;
}): Promise<TransactionalEmailResult> {
  const {
    toEmail,
    firstName,
    lastName,
    phone,
    planName,
    enrollmentId,
    organizationName,
    fromEmail = DEFAULT_FROM_EMAIL,
    fromName,
  } = params;

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: `${fromName || organizationName} <${fromEmail}>`,
      to: [toEmail],
      subject: `Enrollment Received - ${organizationName}`,
      html: getEnrollmentConfirmationHtml({
        firstName,
        lastName,
        email: toEmail,
        phone,
        planName,
        enrollmentId,
        organizationName,
      }),
    });

    if (error) {
      console.error('Failed to send enrollment confirmation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending enrollment confirmation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send advisor notification email when a new enrollment is assigned
 */
export async function sendAdvisorNotificationEmail(params: {
  advisorEmail: string;
  advisorName: string;
  memberFirstName: string;
  memberLastName: string;
  memberEmail: string;
  memberPhone: string;
  enrollmentId: string;
  organizationName: string;
  fromEmail?: string;
  fromName?: string;
}): Promise<TransactionalEmailResult> {
  const {
    advisorEmail,
    advisorName,
    memberFirstName,
    memberLastName,
    memberEmail,
    memberPhone,
    enrollmentId,
    organizationName,
    fromEmail = DEFAULT_FROM_EMAIL,
    fromName = DEFAULT_FROM_NAME,
  } = params;

  const crmLink = `${APP_URL}/crm/enrollments/${enrollmentId}`;

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [advisorEmail],
      subject: `New Enrollment Assigned: ${memberFirstName} ${memberLastName}`,
      html: getAdvisorNotificationHtml({
        advisorName,
        memberFirstName,
        memberLastName,
        memberEmail,
        memberPhone,
        enrollmentId,
        organizationName,
        crmLink,
      }),
    });

    if (error) {
      console.error('Failed to send advisor notification email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending advisor notification email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
