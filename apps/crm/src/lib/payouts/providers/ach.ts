/**
 * ACH Payment Provider
 *
 * Abstraction for ACH bank transfers.
 * In production, integrate with a provider like Dwolla, Plaid, or bank API.
 * This implementation provides the interface contract + logging.
 */

import type { PaymentProvider, PayoutRequest, PayoutResult } from './types';

export class AchProvider implements PaymentProvider {
  readonly providerType = 'ach' as const;

  async sendPayout(request: PayoutRequest): Promise<PayoutResult> {
    try {
      // In production: call ACH provider API (Dwolla, Plaid Transfer, etc.)
      // For now, mark as submitted — actual ACH integration is provider-specific.
      //
      // Example Dwolla flow:
      //   const transfer = await dwolla.post('transfers', {
      //     _links: { source: { href: fundingSource }, destination: { href: advisorFundingSource } },
      //     amount: { currency: 'USD', value: request.amount.toFixed(2) },
      //   });

      console.log(
        `[ACH] Payout submitted: $${request.amount} to advisor ${request.advisorId} (idempotency: ${request.idempotencyKey})`
      );

      // Generate a trace-style reference
      const traceNumber = `ACH-${Date.now()}-${request.payoutItemId.slice(0, 8)}`;

      return {
        providerTransactionId: traceNumber,
        status: 'submitted',
        rawResponse: {
          trace_number: traceNumber,
          amount: request.amount,
          currency: request.currency,
          submitted_at: new Date().toISOString(),
          note: 'ACH transfers typically settle in 1-3 business days',
        },
      };
    } catch (error) {
      return {
        providerTransactionId: null,
        status: 'failed',
        rawResponse: {
          error: error instanceof Error ? error.message : 'ACH submission failed',
        },
        failureReason: error instanceof Error ? error.message : 'ACH submission failed',
        failureCode: 'ACH_ERROR',
      };
    }
  }

  async checkStatus(providerTransactionId: string): Promise<{
    status: 'pending' | 'submitted' | 'succeeded' | 'failed' | 'reversed';
    rawResponse: Record<string, unknown>;
  }> {
    // In production: poll the ACH provider for settlement status.
    // ACH transfers typically take 1-3 business days.
    console.log(`[ACH] Status check for: ${providerTransactionId}`);

    return {
      status: 'submitted', // Default: still processing
      rawResponse: {
        trace_number: providerTransactionId,
        note: 'ACH status check — integrate with provider API for real status',
      },
    };
  }
}
