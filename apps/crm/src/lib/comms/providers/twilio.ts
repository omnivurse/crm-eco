/**
 * CRM Communications - Twilio Provider Adapter
 * SMS sending via Twilio API
 */

import type { ProviderSendRequest, ProviderSendResult } from '../types';

// ============================================================================
// Configuration
// ============================================================================

function getConfig(): { accountSid: string; authToken: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables must be set');
  }
  
  return { accountSid, authToken };
}

function getApiUrl(accountSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
}

// ============================================================================
// Send SMS
// ============================================================================

/**
 * Send an SMS via Twilio
 */
export async function sendSms(request: ProviderSendRequest): Promise<ProviderSendResult> {
  try {
    const { accountSid, authToken } = getConfig();
    const apiUrl = getApiUrl(accountSid);
    
    // Build form data for Twilio API
    const formData = new URLSearchParams();
    formData.append('To', request.to);
    formData.append('From', request.from);
    formData.append('Body', request.body);
    
    // Add status callback URL if configured
    const callbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
    if (callbackUrl) {
      formData.append('StatusCallback', callbackUrl);
    }
    
    // Send request with Basic auth
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
    const data = await response.json();
    
    // Twilio returns 201 Created on success
    if (response.status === 201) {
      return {
        success: true,
        providerMessageId: data.sid,
      };
    }
    
    // Handle error response
    return {
      success: false,
      error: data.message || `Twilio API error: ${response.status}`,
      errorCode: String(data.code),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Twilio error',
    };
  }
}

// ============================================================================
// Webhook Event Mapping
// ============================================================================

/**
 * Map Twilio status to our message status
 */
export function mapTwilioStatusToMessageStatus(twilioStatus: string): string {
  switch (twilioStatus.toLowerCase()) {
    case 'queued':
    case 'accepted':
      return 'queued';
    case 'sending':
      return 'sending';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'failed':
    case 'undelivered':
      return 'failed';
    default:
      return 'sent';
  }
}

/**
 * Check if a Twilio status is terminal (no more updates expected)
 */
export function isTerminalStatus(status: string): boolean {
  return ['delivered', 'failed', 'undelivered'].includes(status.toLowerCase());
}

// ============================================================================
// Phone Number Validation
// ============================================================================

/**
 * Normalize phone number to E.164 format
 * Assumes US numbers if no country code provided
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle US numbers
  if (digits.length === 10) {
    digits = '1' + digits;
  }
  
  // Add + prefix if not present
  if (!digits.startsWith('+')) {
    digits = '+' + digits;
  }
  
  return digits;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // E.164 format: + followed by 10-15 digits
  return /^\+[1-9]\d{9,14}$/.test(normalized);
}

/**
 * Check if Twilio is configured
 */
export function isConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

// ============================================================================
// SMS Length Utilities
// ============================================================================

const GSM_BASIC_CHARS = /^[A-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-.\/:;<=>?¡ÄÖÑÜĀäöñüà\n\r]*$/;

/**
 * Check if message uses GSM-7 encoding (160 chars per segment)
 * or UCS-2 encoding (70 chars per segment)
 */
export function getMessageEncoding(message: string): 'gsm7' | 'ucs2' {
  return GSM_BASIC_CHARS.test(message) ? 'gsm7' : 'ucs2';
}

/**
 * Calculate number of SMS segments needed
 */
export function calculateSegments(message: string): {
  encoding: 'gsm7' | 'ucs2';
  segments: number;
  charLimit: number;
  remaining: number;
} {
  const encoding = getMessageEncoding(message);
  const length = message.length;
  
  let singleLimit: number;
  let multiLimit: number;
  
  if (encoding === 'gsm7') {
    singleLimit = 160;
    multiLimit = 153; // 7 chars reserved for UDH
  } else {
    singleLimit = 70;
    multiLimit = 67; // 3 chars reserved for UDH
  }
  
  let segments: number;
  let charLimit: number;
  
  if (length <= singleLimit) {
    segments = 1;
    charLimit = singleLimit;
  } else {
    segments = Math.ceil(length / multiLimit);
    charLimit = multiLimit * segments;
  }
  
  return {
    encoding,
    segments,
    charLimit,
    remaining: charLimit - length,
  };
}
