/**
 * Webhook Types
 * Common interfaces for webhook handling
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface WebhookContext {
  supabase: SupabaseClient;
  orgId?: string;
  connectionId?: string;
}

export interface WebhookResult {
  success: boolean;
  eventType: string;
  entityType?: string;
  entityId?: string;
  connectionId?: string;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface WebhookHandler {
  /**
   * Provider ID this handler is for
   */
  readonly providerId: string;

  /**
   * Verify the webhook signature
   */
  verifySignature(
    payload: string,
    signature: string | null,
    headers: Record<string, string>
  ): Promise<boolean>;

  /**
   * Parse the raw payload into a structured event
   */
  parseEvent(
    payload: string,
    headers: Record<string, string>
  ): { eventType: string; data: unknown };

  /**
   * Process the webhook event
   */
  processEvent(
    eventType: string,
    data: unknown,
    context: WebhookContext
  ): Promise<WebhookResult>;
}

/**
 * Signature verification methods for different providers
 */
export type SignatureMethod =
  | 'hmac-sha256'
  | 'hmac-sha1'
  | 'stripe'
  | 'svix'
  | 'none';

export interface WebhookConfig {
  providerId: string;
  signatureMethod: SignatureMethod;
  signatureHeader: string;
  timestampHeader?: string;
  toleranceSeconds?: number;
}

/**
 * Webhook configurations for known providers
 */
export const WEBHOOK_CONFIGS: Record<string, WebhookConfig> = {
  stripe: {
    providerId: 'stripe',
    signatureMethod: 'stripe',
    signatureHeader: 'stripe-signature',
  },
  sendgrid: {
    providerId: 'sendgrid',
    signatureMethod: 'none', // SendGrid uses basic auth or signed event webhooks
    signatureHeader: 'x-twilio-email-event-webhook-signature',
    timestampHeader: 'x-twilio-email-event-webhook-timestamp',
  },
  resend: {
    providerId: 'resend',
    signatureMethod: 'svix',
    signatureHeader: 'svix-signature',
    timestampHeader: 'svix-timestamp',
  },
  twilio: {
    providerId: 'twilio',
    signatureMethod: 'hmac-sha1',
    signatureHeader: 'x-twilio-signature',
  },
  docusign: {
    providerId: 'docusign',
    signatureMethod: 'hmac-sha256',
    signatureHeader: 'x-docusign-signature-1',
  },
  zoom: {
    providerId: 'zoom',
    signatureMethod: 'hmac-sha256',
    signatureHeader: 'x-zm-signature',
    timestampHeader: 'x-zm-request-timestamp',
    toleranceSeconds: 300,
  },
  slack: {
    providerId: 'slack',
    signatureMethod: 'hmac-sha256',
    signatureHeader: 'x-slack-signature',
    timestampHeader: 'x-slack-request-timestamp',
    toleranceSeconds: 300,
  },
};
