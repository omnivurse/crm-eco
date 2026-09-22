import type { MembershipLayer, MembershipLayerRow, ShopTerms } from './types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseShopTerms(metadata: unknown): ShopTerms {
  const shop = asRecord(asRecord(metadata).shop);
  const kind = shop.kind === 'addon' ? 'addon' : 'core';
  return {
    kind,
    purchasable: shop.purchasable === true,
    frequency:
      shop.frequency === 'quarterly' || shop.frequency === 'annual' || shop.frequency === 'monthly'
        ? shop.frequency
        : 'monthly',
  };
}

/**
 * Validates a plan before the service-role checkout path treats it as an add-on.
 * Portal callers may only select plans explicitly published in the shop, while
 * staff may assign hidden add-ons without turning a core plan into a second layer.
 */
export function validateAddonPlanSelection(
  shop: ShopTerms,
  source: 'portal_shop' | 'staff_addon',
): { ok: true } | { ok: false; error: string } {
  if (shop.kind !== 'addon') {
    return { ok: false, error: 'That plan is not available as an add-on.' };
  }
  if (source === 'portal_shop' && !shop.purchasable) {
    return { ok: false, error: 'That add-on is not available in the member shop.' };
  }
  return { ok: true };
}

export function membershipLayerOf(row: Pick<MembershipLayerRow, 'layer' | 'custom_fields'>): MembershipLayer {
  if (row.layer === 'addon' || row.layer === 'core') return row.layer;
  const custom = asRecord(row.custom_fields).layer;
  return custom === 'addon' ? 'addon' : 'core';
}

export function isOpenMembership(status: string): boolean {
  return status === 'active' || status === 'pending';
}

export function isSponsoredMembership(row: Pick<MembershipLayerRow, 'sponsor_id'>): boolean {
  return Boolean(row.sponsor_id);
}

export function decideMembershipAdd(input: {
  existing: MembershipLayerRow[];
  next: { plan_id: string; layer: MembershipLayer; sponsored: boolean };
}): { ok: true } | { ok: false; error: string } {
  const open = input.existing.filter((row) => isOpenMembership(row.status));

  if (open.some((row) => row.plan_id === input.next.plan_id)) {
    return { ok: false, error: 'This member already has that plan.' };
  }

  if (input.next.sponsored && open.some((row) => isSponsoredMembership(row))) {
    return { ok: false, error: 'A member can have only one sponsored membership.' };
  }

  const openCores = open.filter((row) => membershipLayerOf(row) === 'core' && !isSponsoredMembership(row));
  if (input.next.layer === 'core' && !input.next.sponsored && openCores.some((row) => row.status === 'active')) {
    return {
      ok: false,
      error: 'This member already has an active core plan. Change or end it, or add an add-on instead.',
    };
  }

  if (input.next.layer === 'addon') {
    const hasHousehold = open.some(
      (row) => membershipLayerOf(row) === 'core' || isSponsoredMembership(row),
    );
    if (!hasHousehold) {
      return { ok: false, error: 'Add an active core or sponsored membership before adding an add-on.' };
    }
  }

  return { ok: true };
}

export function withMembershipLayer(
  customFields: unknown,
  layer: MembershipLayer,
): Record<string, unknown> {
  return { ...asRecord(customFields), layer };
}
