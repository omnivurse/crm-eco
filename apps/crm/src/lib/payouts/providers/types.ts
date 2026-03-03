/**
 * Payment Provider Abstraction Types
 *
 * Provider-agnostic interface for sending payouts.
 * Implementations: StripeConnect, ACH, Manual.
 */

export interface PayoutRequest {
  /** Internal provider transaction ID */
  txnId: string;
  /** Payout item ID */
  payoutItemId: string;
  /** Advisor ID for recipient resolution */
  advisorId: string;
  /** Amount in dollars (not cents) */
  amount: number;
  /** Currency code */
  currency: string;
  /** Idempotency key — must be unique per attempt */
  idempotencyKey: string;
  /** Optional metadata passed to provider */
  metadata?: Record<string, string>;
}

export interface PayoutResult {
  /** Provider-assigned transaction ID (Stripe transfer ID, ACH trace, etc.) */
  providerTransactionId: string | null;
  /** Resulting status */
  status: 'submitted' | 'succeeded' | 'failed';
  /** Raw provider response (PII-safe subset) */
  rawResponse: Record<string, unknown>;
  /** Failure reason if failed */
  failureReason?: string;
  /** Provider-specific error code */
  failureCode?: string;
}

export interface PaymentProvider {
  /** Provider type identifier */
  readonly providerType: 'stripe_connect' | 'ach' | 'manual';

  /**
   * Send a payout to a recipient.
   * Must be idempotent (same idempotencyKey = same result).
   * Must NOT throw — return failed status instead.
   */
  sendPayout(request: PayoutRequest): Promise<PayoutResult>;

  /**
   * Check the status of a previously submitted payout.
   * Used by reconciliation.
   */
  checkStatus(providerTransactionId: string): Promise<{
    status: 'pending' | 'submitted' | 'succeeded' | 'failed' | 'reversed';
    rawResponse: Record<string, unknown>;
  }>;
}

export interface ProviderConfig {
  stripe_connect?: {
    stripe_account_id?: string;
    /** Additional Stripe-specific config */
    [key: string]: unknown;
  };
  ach?: {
    /** ACH-specific config */
    [key: string]: unknown;
  };
  manual?: Record<string, unknown>;
}
