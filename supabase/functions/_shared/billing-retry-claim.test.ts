import {
  BILLING_RETRY_TRANSACTION_TYPE,
  billingRetryIdempotencyKey,
} from './billing-retry-claim.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn();
  } catch (error) {
    assertEquals(error instanceof Error ? error.message : String(error), message);
    return;
  }
  throw new Error(`Expected function to throw "${message}"`);
}

Deno.test('billing retries use a transaction type accepted by the live schema', () => {
  assertEquals(BILLING_RETRY_TRANSACTION_TYPE, 'charge');
});

Deno.test('billing retries deduplicate one attempt without blocking the next', () => {
  assertEquals(billingRetryIdempotencyKey('failure-1', 1), 'billing_retry:failure-1:1');
  assertEquals(billingRetryIdempotencyKey('failure-1', 2), 'billing_retry:failure-1:2');
});

Deno.test('billing retry claims reject malformed inputs', () => {
  assertThrows(() => billingRetryIdempotencyKey('', 1), 'Billing failure id is required');
  assertThrows(
    () => billingRetryIdempotencyKey('failure-1', 0),
    'Billing retry attempt must be a positive integer'
  );
});
