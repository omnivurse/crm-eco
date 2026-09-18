export type ShopChargeKind = 'plan' | 'package';
export type SupportedShopBillingFrequency = 'monthly' | 'quarterly' | 'annual';

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

export function requireSupportedShopBillingFrequency(
  frequency: string | null | undefined,
): SupportedShopBillingFrequency {
  const normalized = frequency || 'monthly';
  if (normalized === 'monthly' || normalized === 'quarterly' || normalized === 'annual') {
    return normalized;
  }
  throw new Error(`Unsupported recurring shop billing frequency: ${normalized}`);
}

/** First recurring bill after the period collected during checkout. */
export function nextShopBillingDate(
  effectiveDate: string,
  frequency: SupportedShopBillingFrequency,
  billingDay = 20,
): string {
  const date = new Date(`${effectiveDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid shop effective date');

  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + shopPeriodMonths(frequency));
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(Math.max(1, billingDay), lastDay));
  return date.toISOString().slice(0, 10);
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
