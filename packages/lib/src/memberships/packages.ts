import type { MemberPackageStatus, PackageRedeemPlan } from './types';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function planPackageRedeem(input: {
  unitsRemaining: number;
  redeemUnits: number;
  deferredRemaining: number;
  unitsPurchased: number;
}): PackageRedeemPlan | { ok: false; error: string } {
  const redeemUnits = Number(input.redeemUnits);
  if (!Number.isFinite(redeemUnits) || redeemUnits <= 0) {
    return { ok: false, error: 'Redeem at least one unit.' };
  }
  if (redeemUnits > input.unitsRemaining) {
    return { ok: false, error: 'Not enough units remaining on this package.' };
  }

  const remaining = input.unitsRemaining - redeemUnits;
  const portion = input.unitsPurchased > 0 ? redeemUnits / input.unitsPurchased : 1;
  const deferred_remaining = roundMoney(Math.max(input.deferredRemaining - input.deferredRemaining * portion, 0));

  return {
    remaining,
    status: remaining === 0 ? 'exhausted' : 'active',
    deferred_remaining,
  };
}

export function packagePurchaseAmounts(input: {
  price: number;
  taxRate: number;
  quantity: number;
}): { subtotal: number; tax_amount: number; total: number } {
  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const subtotal = roundMoney(Number(input.price) * quantity);
  const tax_amount = roundMoney(subtotal * (Number(input.taxRate) || 0));
  return { subtotal, tax_amount, total: roundMoney(subtotal + tax_amount) };
}

export function isUsableMemberPackage(status: MemberPackageStatus, expiresAt?: string | null): boolean {
  if (status !== 'active') return false;
  if (!expiresAt) return true;
  return expiresAt >= new Date().toISOString().slice(0, 10);
}
