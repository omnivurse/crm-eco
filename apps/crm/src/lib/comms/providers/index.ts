/**
 * CRM Communications - Provider Registry
 */

export * from './sendgrid';
export * from './twilio';

import { sendEmail, isConfigured as isSendGridConfigured } from './sendgrid';
import { sendSms, isConfigured as isTwilioConfigured } from './twilio';
import type { ProviderSendRequest, ProviderSendResult, MessageChannel } from '../types';

/**
 * Send a message via the appropriate provider
 */
export async function sendMessage(
  channel: MessageChannel,
  request: ProviderSendRequest
): Promise<ProviderSendResult> {
  if (channel === 'email') {
    if (!isSendGridConfigured()) {
      return {
        success: false,
        error: 'SendGrid is not configured',
      };
    }
    return sendEmail(request);
  } else {
    if (!isTwilioConfigured()) {
      return {
        success: false,
        error: 'Twilio is not configured',
      };
    }
    return sendSms(request);
  }
}

/**
 * Check provider availability
 */
export function getProviderStatus(): {
  email: { configured: boolean; provider: string };
  sms: { configured: boolean; provider: string };
} {
  return {
    email: {
      configured: isSendGridConfigured(),
      provider: 'sendgrid',
    },
    sms: {
      configured: isTwilioConfigured(),
      provider: 'twilio',
    },
  };
}
