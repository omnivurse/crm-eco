export type ShopChargeKind = 'plan' | 'package';

export function shopChargePeriod(asOf = new Date()): string {
  return `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function shopChargeIdempotencyKey(input: {
  memberId: string;
  itemType: ShopChargeKind;
  itemId: string;
  period?: string;
}): string {
  const period = input.period ?? shopChargePeriod();
  return `shop_${input.itemType}_${input.memberId}_${input.itemId}_${period}`;
}

export function shopPeriodMonths(frequency: string | null | undefined): number {
  if (frequency === 'quarterly') return 3;
  if (frequency === 'semi_annual') return 6;
  if (frequency === 'annual') return 12;
  return 1;
}

export function shopPeriodAmountCents(
  monthlyShare: number,
  frequency: string | null | undefined,
): number {
  return Math.max(0, Math.round(Number(monthlyShare || 0) * shopPeriodMonths(frequency) * 100));
}

export function shouldProvisionAfterShopCharge(charge: {
  success: boolean;
}): boolean {
  return charge.success === true;
}

export function shopPaymentUsesNachaQueue(paymentType: string | null | undefined): boolean {
  return paymentType === 'bank_account';
}

export function shopAchAllowsItem(itemType: 'plan' | 'package'): boolean {
  return itemType === 'plan';
}

export function shopAchCartGuard(input: {
  paymentType?: string | null;
  itemTypes: Array<'plan' | 'package'>;
}): { ok: true } | { ok: false; error: string } {
  if (!shopPaymentUsesNachaQueue(input.paymentType)) return { ok: true };
  if (input.itemTypes.some((itemType) => !shopAchAllowsItem(itemType))) {
    return {
      ok: false,
      error:
        'Prepaid packages require a card. ACH can only buy add-on memberships until the bank file settles.',
    };
  }
  return { ok: true };
}

export function shopCardGatewayGuard(input: {
  paymentType?: string | null;
  processor?: string | null;
  gatewayCustomerId?: string | null;
  gatewayPaymentProfileId?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (shopPaymentUsesNachaQueue(input.paymentType)) {
    return { ok: false, error: 'ACH shop purchases queue for NACHA. Do not charge a card processor.' };
  }
  if (!input.gatewayCustomerId || !input.gatewayPaymentProfileId) {
    return { ok: false, error: 'Add a payment method before buying from the shop.' };
  }
  const processor = (input.processor || '').trim().toLowerCase();
  if (!processor || processor === 'placeholder') {
    return {
      ok: false,
      error: 'Card checkout requires a live card processor. Placeholder charges are refused.',
    };
  }
  return { ok: true };
}
