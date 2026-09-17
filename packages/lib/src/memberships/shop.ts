import { decideMembershipAdd, membershipLayerOf, parseShopTerms } from './layers';
import type {
  MembershipLayerRow,
  ShopCartItemInput,
  ShopCatalogPackage,
  ShopCatalogPlan,
} from './types';

export function buildShopCatalog(input: {
  plans: Array<{
    id: string;
    name: string;
    code: string;
    monthly_share: number | null;
    description: string | null;
    is_active?: boolean | null;
    metadata?: unknown;
  }>;
  packages: Array<{
    id: string;
    name: string;
    sku: string | null;
    description: string | null;
    price: number | string;
    tax_rate?: number | string | null;
    units: number;
    unit_label?: string | null;
    entitlement_kind?: string | null;
    is_active?: boolean | null;
  }>;
  existing: MembershipLayerRow[];
}): { plans: ShopCatalogPlan[]; packages: ShopCatalogPackage[] } {
  const plans = input.plans.flatMap((plan) => {
    if (plan.is_active === false) return [];
    const shop = parseShopTerms(plan.metadata);
    if (!shop.purchasable || shop.kind !== 'addon') return [];
    const allowed = decideMembershipAdd({
      existing: input.existing,
      next: { plan_id: plan.id, layer: 'addon', sponsored: false },
    });
    if (!allowed.ok) return [];
    return [
      {
        id: plan.id,
        name: plan.name,
        code: plan.code,
        monthly_share: plan.monthly_share,
        description: plan.description,
        frequency: shop.frequency ?? 'monthly',
      },
    ];
  });

  const packages = input.packages.flatMap((row) => {
    if (row.is_active === false) return [];
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0) return [];
    return [
      {
        id: row.id,
        name: row.name,
        sku: row.sku,
        description: row.description,
        price,
        tax_rate: Number(row.tax_rate) || 0,
        units: row.units,
        unit_label: row.unit_label || 'units',
        entitlement_kind: ((): ShopCatalogPackage['entitlement_kind'] => {
          if (
            row.entitlement_kind === 'visits' ||
            row.entitlement_kind === 'dollars' ||
            row.entitlement_kind === 'months'
          ) {
            return row.entitlement_kind;
          }
          return 'units';
        })(),
      },
    ];
  });

  return { plans, packages };
}

export function normalizeCartItems(items: ShopCartItemInput[]): ShopCartItemInput[] {
  const seen = new Set<string>();
  const next: ShopCartItemInput[] = [];
  for (const item of items) {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    if (item.item_type === 'plan' && item.plan_id) {
      const key = `plan:${item.plan_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ item_type: 'plan', plan_id: item.plan_id, quantity: 1 });
    }
    if (item.item_type === 'package' && item.package_id) {
      const key = `package:${item.package_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ item_type: 'package', package_id: item.package_id, quantity });
    }
  }
  return next;
}

export function householdMemberships<T extends MembershipLayerRow>(rows: T[]): T[] {
  return rows.filter((row) => membershipLayerOf(row) !== 'addon');
}
