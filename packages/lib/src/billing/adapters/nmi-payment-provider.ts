/**
 * NMI adapter for the PaymentProvider seam.
 * Vaults Payment Component tokens into Customer Vault, then charges with
 * merchant-initiated sales.
 */

import {
  NMI_OPAQUE_DESCRIPTOR,
  NmiClient,
  createNmiClientFromEnv,
} from '../nmi';
import type {
  ChargeInput,
  ChargeResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VaultPaymentInput,
  VaultPaymentResult,
} from '../payment-provider';

export class NmiPaymentProvider implements PaymentProvider {
  readonly name = 'nmi';

  constructor(private readonly gateway: NmiClient) {}

  async vaultPaymentMethod(input: VaultPaymentInput): Promise<VaultPaymentResult> {
    if (input.method.type !== 'opaque') {
      return {
        success: false,
        error:
          'NMI only accepts browser-tokenized payment methods. Use the NMI Payment Component (no raw card or ACH).',
      };
    }

    const descriptor = input.method.descriptor.trim();
    if (descriptor && descriptor !== NMI_OPAQUE_DESCRIPTOR && descriptor !== 'payment_token') {
      return {
        success: false,
        error: `Unsupported NMI token descriptor "${descriptor}"`,
      };
    }

    const created = await this.gateway.createCustomer({
      paymentToken: input.method.value,
      email: input.email,
      merchantCustomerId: input.memberId,
      billingAddress: {
        firstName: input.billingAddress?.firstName,
        lastName: input.billingAddress?.lastName,
        email: input.email,
        line1: input.billingAddress?.line1,
        city: input.billingAddress?.city,
        state: input.billingAddress?.state,
        zip: input.billingAddress?.zip,
        country: 'US',
      },
    });

    if (!created.success || !created.customerVaultId) {
      return { success: false, error: created.error ?? 'NMI vault failed' };
    }

    const paymentProfileId = created.billingId ?? created.customerVaultId;
    return {
      success: true,
      gatewayCustomerId: created.customerVaultId,
      gatewayPaymentProfileId: paymentProfileId,
      paymentType: created.paymentType ?? 'credit_card',
      lastFour: created.lastFour,
      brand: created.brand,
      expiration: created.expiration,
    };
  }

  async chargeOnce(input: ChargeInput): Promise<ChargeResult> {
    const billingId =
      input.gatewayPaymentProfileId &&
      input.gatewayPaymentProfileId !== input.gatewayCustomerId
        ? input.gatewayPaymentProfileId
        : undefined;
    const result = await this.gateway.sale({
      customerVaultId: input.gatewayCustomerId,
      billingId,
      amountCents: input.amountCents,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      success: result.success,
      transactionId: result.transactionId,
      status: result.status,
      error: result.error,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const result = await this.gateway.refund({
      transactionId: input.transactionId,
      amountCents: input.amountCents,
    });
    return {
      success: result.success,
      transactionId: result.transactionId,
      error: result.error,
    };
  }
}

export function createNmiPaymentProvider(client?: NmiClient): NmiPaymentProvider {
  return new NmiPaymentProvider(client ?? createNmiClientFromEnv());
}
