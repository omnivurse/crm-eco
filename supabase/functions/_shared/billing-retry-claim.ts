/**
 * Durable identifiers for one dunning retry attempt.
 *
 * `billing_transactions.transaction_type` only accepts `charge`, `refund`,
 * `void`, or `adjustment`; retries are still charge transactions.
 */
export const BILLING_RETRY_TRANSACTION_TYPE = 'charge' as const;

export function billingRetryIdempotencyKey(failureId: string, attempt: number): string {
  const normalizedFailureId = failureId.trim();
  if (!normalizedFailureId) {
    throw new Error('Billing failure id is required');
  }
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error('Billing retry attempt must be a positive integer');
  }
  return `billing_retry:${normalizedFailureId}:${attempt}`;
}
