/**
 * Manual Payment Provider
 *
 * For orgs that process payouts manually (check, wire, etc.).
 * Immediately marks as "succeeded" since the admin is handling disbursement.
 */

import type { PaymentProvider, PayoutRequest, PayoutResult } from './types';

export class ManualProvider implements PaymentProvider {
  readonly providerType = 'manual' as const;

  async sendPayout(request: PayoutRequest): Promise<PayoutResult> {
    // Manual payouts are immediately "succeeded" — the admin
    // has already confirmed they will handle the actual payment.
    const reference = `MANUAL-${Date.now()}-${request.payoutItemId.slice(0, 8)}`;

    return {
      providerTransactionId: reference,
      status: 'succeeded',
      rawResponse: {
        reference,
        amount: request.amount,
        currency: request.currency,
        processed_at: new Date().toISOString(),
        method: 'manual',
      },
    };
  }

  async checkStatus(providerTransactionId: string): Promise<{
    status: 'pending' | 'submitted' | 'succeeded' | 'failed' | 'reversed';
    rawResponse: Record<string, unknown>;
  }> {
    // Manual payouts are always succeeded once created
    return {
      status: 'succeeded',
      rawResponse: {
        reference: providerTransactionId,
        method: 'manual',
      },
    };
  }
}
