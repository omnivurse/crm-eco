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
