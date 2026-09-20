/**
 * Processor-aware charge/refund resolver.
 *
 * Existing Authorize.Net CIM ids cannot charge on NMI. Read
 * payment_profiles.processor and route to the matching adapter.
 * Missing / unknown processor defaults to authorizenet (pre-NMI rows).
 */

import { createAuthorizeNetPaymentProvider } from './adapters/authorizenet-payment-provider';
import { createNmiPaymentProvider } from './adapters/nmi-payment-provider';
import type { PaymentProvider } from './payment-provider';

export type StoredPaymentProcessor = 'nmi' | 'authorizenet';

export function normalizeStoredPaymentProcessor(
  value: string | null | undefined,
): StoredPaymentProcessor {
  return value?.trim().toLowerCase() === 'nmi' ? 'nmi' : 'authorizenet';
}

export function getPaymentProviderForProcessor(
  processor: string | null | undefined,
): PaymentProvider {
  if (normalizeStoredPaymentProcessor(processor) === 'nmi') {
    return createNmiPaymentProvider();
  }
  return createAuthorizeNetPaymentProvider();
}

export function dollarsToCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}
