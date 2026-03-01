/**
 * CRM Communications - Resend Provider Adapter
 * Email sending via Resend API with RFC 8058 List-Unsubscribe support
 */

import type { ProviderSendRequest, ProviderSendResult } from '../types';

// ============================================================================
// Helpers
// ============================================================================

/** Strip HTML tags to produce a plain-text version for multipart emails */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// Configuration
// ============================================================================

const RESEND_API_URL = 'https://api.resend.com/emails';

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return key;
}

// ============================================================================
// Send Email
// ============================================================================

/**
 * Send an email via Resend
 */
export async function sendEmail(request: ProviderSendRequest): Promise<ProviderSendResult> {
  try {
    const apiKey = getApiKey();

    const payload: Record<string, unknown> = {
      from: request.fromName
        ? `${request.fromName} <${request.from}>`
        : request.from,
      to: [request.to],
      subject: request.subject || '(No Subject)',
      html: request.body,
      text: htmlToPlainText(request.body),
    };

    // Add reply-to if provided
    if (request.replyTo) {
      payload.reply_to = request.replyTo;
    }

    // Add List-Unsubscribe headers for deliverability (RFC 8058)
    const unsubscribeUrl = (request.meta as Record<string, unknown> | undefined)?.unsubscribe_url as string | undefined;
    if (unsubscribeUrl) {
      payload.headers = {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
    }

    // Add message ID as tag for tracking
    payload.tags = [{ name: 'message_id', value: request.messageId }];

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        providerMessageId: data.id,
      };
    }

    // Handle error response
    let errorMessage = `Resend API error: ${response.status}`;
    let errorCode: string | undefined;

    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = errorBody.message;
      }
      errorCode = errorBody.name;
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
      error: error instanceof Error ? error.message : 'Unknown Resend error',
    };
  }
}

// ============================================================================
// Webhook Event Mapping
// ============================================================================

/**
 * Map Resend webhook event type to our message status
 */
export function mapResendEventToStatus(event: string): string {
  switch (event) {
    case 'email.sent':
      return 'sending';
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'spam';
    case 'email.delivery_delayed':
      return 'sending';
    case 'email.opened':
    case 'email.clicked':
      return 'delivered';
    default:
      return 'sent';
  }
}

/**
 * Check if an event should update message status
 */
export function shouldUpdateStatus(event: string): boolean {
  return ['email.sent', 'email.delivered', 'email.bounced', 'email.complained'].includes(event);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if Resend is configured
 */
export function isConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
