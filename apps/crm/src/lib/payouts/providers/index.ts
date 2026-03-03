/**
 * Payment Provider Registry
 *
 * Resolves the correct provider implementation by type.
 */

export { StripeConnectProvider } from './stripe-connect';
export { AchProvider } from './ach';
export { ManualProvider } from './manual';
export type { PaymentProvider, PayoutRequest, PayoutResult, ProviderConfig } from './types';

import type { PaymentProvider } from './types';
import { StripeConnectProvider } from './stripe-connect';
import { AchProvider } from './ach';
import { ManualProvider } from './manual';

const providers: Record<string, PaymentProvider> = {
  stripe_connect: new StripeConnectProvider(),
  ach: new AchProvider(),
  manual: new ManualProvider(),
};

/**
 * Get a payment provider by type.
 * Falls back to manual if type is unknown.
 */
export function getPaymentProvider(providerType: string): PaymentProvider {
  return providers[providerType] || providers.manual;
}
