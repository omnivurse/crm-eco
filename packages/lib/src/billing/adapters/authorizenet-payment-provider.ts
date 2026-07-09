/**
 * Authorize.Net adapter for the PaymentProvider seam.
 * Wraps AuthorizeNetService so enrollment finalize / callers use getPaymentProvider()
 * instead of importing the gateway directly.
 */

import {
  createAuthorizeNetService,
  type AuthorizeNetService,
  type BillingAddress,
  type CreditCardPaymentMethod,
  type BankAccountPaymentMethod,
} from '../authorize-net';
import type {
  ChargeInput,
  ChargeResult,
  PaymentBillingAddress,
  PaymentProvider,
  VaultPaymentInput,
  VaultPaymentResult,
} from '../payment-provider';

function normalizeCardExpiration(expiration: string): string {
  const digits = expiration.replace(/\D/g, '');
  if (digits.length === 4) {
    // MMYY → YYYY-MM
    const mm = digits.slice(0, 2);
    const yy = digits.slice(2, 4);
    return `20${yy}-${mm}`;
  }
  if (digits.length === 6) {
    // YYYYMM
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  }
  if (/^\d{4}-\d{2}$/.test(expiration)) return expiration;
  return expiration;
}

/** Map optional PaymentProvider address to Authorize.Net (first/last name required). */
function toAuthorizeNetBillingAddress(
  addr: PaymentBillingAddress | undefined,
  nameFallback?: string,
): BillingAddress | undefined {
  if (!addr && !nameFallback?.trim()) return undefined;

  const firstFromAddr = addr?.firstName?.trim();
  const lastFromAddr = addr?.lastName?.trim();
  const parts = nameFallback?.trim().split(/\s+/).filter(Boolean) ?? [];

  const firstName = firstFromAddr || parts[0] || 'Member';
  const lastName = lastFromAddr || parts.slice(1).join(' ') || parts[0] || 'Member';

  return {
    firstName,
    lastName,
    address: addr?.line1,
    city: addr?.city,
    state: addr?.state,
    zip: addr?.zip,
    country: 'US',
  };
}

export class AuthorizeNetPaymentProvider implements PaymentProvider {
  readonly name = 'authorizenet';

  constructor(private readonly gateway: AuthorizeNetService = createAuthorizeNetService()) {}

  async vaultPaymentMethod(input: VaultPaymentInput): Promise<VaultPaymentResult> {
    try {
      let customerProfileId = input.existingGatewayCustomerId ?? undefined;

      if (!customerProfileId) {
        const created = await this.gateway.createCustomerProfile({
          email: input.email,
          merchantCustomerId: input.memberId,
          description: `org:${input.organizationId}`,
        });
        if (!created.success || !created.customerProfileId) {
          return {
            success: false,
            error: created.errorMessage ?? 'Failed to create Authorize.Net customer profile',
          };
        }
        customerProfileId = created.customerProfileId;
      }

      let paymentMethod: CreditCardPaymentMethod | BankAccountPaymentMethod;
      if (input.method.type === 'card') {
        paymentMethod = {
          type: 'credit_card',
          cardNumber: input.method.cardNumber,
          expirationDate: normalizeCardExpiration(input.method.expiration),
          cardCode: input.method.cardCode,
        };
      } else if (input.method.type === 'ach') {
        paymentMethod = {
          type: 'bank_account',
          accountType: input.method.accountType,
          routingNumber: input.method.routingNumber,
          accountNumber: input.method.accountNumber,
          nameOnAccount: input.method.nameOnAccount,
        };
      } else {
        return {
          success: false,
          error:
            'Authorize.Net adapter does not accept opaque tokens yet — use card or ACH method input',
        };
      }

      const nameFallback =
        input.method.type === 'card'
          ? input.method.nameOnCard
          : input.method.type === 'ach'
            ? input.method.nameOnAccount
            : undefined;

      const billTo = toAuthorizeNetBillingAddress(input.billingAddress, nameFallback);

      const profile = await this.gateway.createPaymentProfile({
        customerProfileId,
        paymentMethod,
        billingAddress: billTo,
        defaultPaymentProfile: true,
      });

      if (!profile.success || !profile.paymentProfileId) {
        return {
          success: false,
          error: profile.errorMessage ?? 'Failed to create Authorize.Net payment profile',
        };
      }

      const paymentType = input.method.type === 'ach' ? 'bank_account' : 'credit_card';
      const lastFour =
        input.method.type === 'card'
          ? input.method.cardNumber.replace(/\D/g, '').slice(-4)
          : input.method.accountNumber.slice(-4);

      return {
        success: true,
        gatewayCustomerId: customerProfileId,
        gatewayPaymentProfileId: profile.paymentProfileId,
        paymentType,
        lastFour,
        brand: paymentType === 'bank_account' ? 'ACH' : undefined,
        expiration:
          input.method.type === 'card'
            ? normalizeCardExpiration(input.method.expiration)
            : undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Authorize.Net vault failed',
      };
    }
  }

  async chargeOnce(input: ChargeInput): Promise<ChargeResult> {
    try {
      const amount = input.amountCents / 100;
      const result = await this.gateway.chargeCustomerProfile({
        customerProfileId: input.gatewayCustomerId,
        paymentProfileId: input.gatewayPaymentProfileId,
        amount,
        invoiceNumber: input.idempotencyKey?.slice(0, 20),
        description: input.description,
      });

      if (result.success) {
        return {
          success: true,
          transactionId: result.transactionId,
          status: 'approved',
        };
      }

      const declined = result.responseCode === '2';
      return {
        success: false,
        transactionId: result.transactionId,
        status: declined ? 'declined' : 'error',
        error: result.errorMessage ?? 'Authorize.Net charge failed',
      };
    } catch (err) {
      return {
        success: false,
        status: 'error',
        error: err instanceof Error ? err.message : 'Authorize.Net charge failed',
      };
    }
  }
}

export function createAuthorizeNetPaymentProvider(): AuthorizeNetPaymentProvider {
  return new AuthorizeNetPaymentProvider();
}
