/**
 * CRM Communications - Provider Registry
 */

export {
  sendEmail,
  isConfigured as isSendGridConfigured,
  isValidEmail,
  mapSendGridEventToStatus,
  shouldUpdateStatus,
} from './sendgrid';

export {
  sendEmail as sendEmailViaResend,
  isConfigured as isResendConfigured,
  mapResendEventToStatus,
  shouldUpdateStatus as shouldUpdateResendStatus,
} from './resend';

export {
  sendSms,
  isConfigured as isTwilioConfigured,
  normalizePhoneNumber,
  isValidPhoneNumber,
  mapTwilioStatusToMessageStatus,
  isTerminalStatus,
  getMessageEncoding,
  calculateSegments,
} from './twilio';

import { sendEmail, isConfigured as isSendGridConfigured } from './sendgrid';
import { sendEmail as sendEmailViaResend, isConfigured as isResendConfigured } from './resend';
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
    // Prefer SendGrid if configured, fall back to Resend
    if (isSendGridConfigured()) {
      return sendEmail(request);
    }
    if (isResendConfigured()) {
      return sendEmailViaResend(request);
    }
    return {
      success: false,
      error: 'No email provider configured (SendGrid or Resend)',
    };
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
  const sendgridReady = isSendGridConfigured();
  const resendReady = isResendConfigured();

  return {
    email: {
      configured: sendgridReady || resendReady,
      provider: sendgridReady ? 'sendgrid' : resendReady ? 'resend' : 'none',
    },
    sms: {
      configured: isTwilioConfigured(),
      provider: 'twilio',
    },
  };
}
