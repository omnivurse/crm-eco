/**
 * CRM Communications - SendGrid Provider Adapter
 * Email sending via SendGrid API
 */

import type { ProviderSendRequest, ProviderSendResult } from '../types';

// ============================================================================
// Configuration
// ============================================================================

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

function getApiKey(): string {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    throw new Error('SENDGRID_API_KEY environment variable is not set');
  }
  return key;
}

// ============================================================================
// Types
// ============================================================================

interface SendGridPersonalization {
  to: Array<{ email: string; name?: string }>;
  subject?: string;
  custom_args?: Record<string, string>;
}

interface SendGridContent {
  type: string;
  value: string;
}

interface SendGridMailRequest {
  personalizations: SendGridPersonalization[];
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  subject: string;
  content: SendGridContent[];
  custom_args?: Record<string, string>;
  tracking_settings?: {
    click_tracking?: { enable: boolean };
    open_tracking?: { enable: boolean };
  };
}

// ============================================================================
// Send Email
// ============================================================================

/**
 * Send an email via SendGrid
 */
export async function sendEmail(request: ProviderSendRequest): Promise<ProviderSendResult> {
  try {
    const apiKey = getApiKey();
    
    // Build SendGrid request
    const mailRequest: SendGridMailRequest = {
      personalizations: [
        {
          to: [{ email: request.to }],
          subject: request.subject,
          custom_args: {
            message_id: request.messageId,
          },
        },
      ],
      from: {
        email: request.from,
        name: request.fromName,
      },
      subject: request.subject || '(No Subject)',
      content: [
        {
          type: 'text/html',
          value: request.body,
        },
      ],
      custom_args: {
        message_id: request.messageId,
      },
      tracking_settings: {
        click_tracking: { enable: true },
        open_tracking: { enable: true },
      },
    };
    
    // Add reply-to if provided
    if (request.replyTo) {
      mailRequest.reply_to = { email: request.replyTo };
    }
    
    // Send request
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailRequest),
    });
    
    // SendGrid returns 202 Accepted on success
    if (response.status === 202) {
      // Extract message ID from headers
      const messageId = response.headers.get('X-Message-Id') || undefined;
      
      return {
        success: true,
        providerMessageId: messageId,
      };
    }
    
    // Handle error response
    let errorMessage = `SendGrid API error: ${response.status}`;
    let errorCode: string | undefined;
    
    try {
      const errorBody = await response.json();
      if (errorBody.errors && errorBody.errors.length > 0) {
        errorMessage = errorBody.errors.map((e: { message: string }) => e.message).join(', ');
        errorCode = errorBody.errors[0]?.field;
      }
    } catch {
      // Ignore JSON parse errors
    }
    
    return {
      success: false,
      error: errorMessage,
      errorCode,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown SendGrid error',
    };
  }
}

// ============================================================================
// Webhook Event Mapping
// ============================================================================

/**
 * Map SendGrid event type to our message status
 */
export function mapSendGridEventToStatus(event: string): string {
  switch (event) {
    case 'processed':
      return 'sending';
    case 'delivered':
      return 'delivered';
    case 'bounce':
    case 'blocked':
      return 'bounced';
    case 'dropped':
      return 'failed';
    case 'spamreport':
      return 'spam';
    case 'unsubscribe':
      return 'unsubscribed';
    case 'deferred':
      return 'sending'; // Still trying
    case 'open':
    case 'click':
      return 'delivered'; // These are engagement events, not status changes
    default:
      return 'sent';
  }
}

/**
 * Check if an event should update message status
 */
export function shouldUpdateStatus(event: string): boolean {
  return ['processed', 'delivered', 'bounce', 'blocked', 'dropped', 'spamreport', 'unsubscribe'].includes(event);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if SendGrid is configured
 */
export function isConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}
