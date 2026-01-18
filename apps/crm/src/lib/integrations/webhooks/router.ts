/**
 * Webhook Router
 * Routes incoming webhooks to the appropriate handler
 */

import type { WebhookHandler, WebhookResult, WebhookContext } from './types';
import { WEBHOOK_CONFIGS } from './types';

// Registry of webhook handlers
const handlers = new Map<string, WebhookHandler>();

/**
 * Register a webhook handler
 */
export function registerWebhookHandler(handler: WebhookHandler): void {
  handlers.set(handler.providerId, handler);
}

/**
 * Get a webhook handler for a provider
 */
export function getWebhookHandler(providerId: string): WebhookHandler | undefined {
  return handlers.get(providerId);
}

/**
 * Check if a webhook handler is registered
 */
export function hasWebhookHandler(providerId: string): boolean {
  return handlers.has(providerId);
}

/**
 * Get webhook config for a provider
 */
export function getWebhookConfig(providerId: string) {
  return WEBHOOK_CONFIGS[providerId];
}

/**
 * Process an incoming webhook
 */
export async function processWebhook(
  providerId: string,
  rawPayload: string,
  headers: Record<string, string>,
  context: WebhookContext
): Promise<WebhookResult> {
  const handler = handlers.get(providerId);

  if (!handler) {
    return {
      success: false,
      eventType: 'unknown',
      error: `No webhook handler registered for provider: ${providerId}`,
    };
  }

  const config = WEBHOOK_CONFIGS[providerId];

  try {
    // Verify signature if config exists
    if (config && config.signatureMethod !== 'none') {
      const signature = headers[config.signatureHeader.toLowerCase()] || null;
      const isValid = await handler.verifySignature(rawPayload, signature, headers);

      if (!isValid) {
        return {
          success: false,
          eventType: 'unknown',
          error: 'Invalid webhook signature',
        };
      }
    }

    // Parse the event
    const { eventType, data } = handler.parseEvent(rawPayload, headers);

    // Process the event
    const result = await handler.processEvent(eventType, data, context);

    return result;
  } catch (error) {
    console.error(`Webhook processing error for ${providerId}:`, error);
    return {
      success: false,
      eventType: 'error',
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    };
  }
}

/**
 * Extract common header values
 */
export function extractHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });

  return result;
}

/**
 * Get list of registered providers
 */
export function getRegisteredWebhookProviders(): string[] {
  return Array.from(handlers.keys());
}
