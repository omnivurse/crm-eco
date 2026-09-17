export type MembershipLayer = 'core' | 'addon';

export type ShopPlanKind = 'core' | 'addon';

export type PackageEntitlementKind = 'visits' | 'dollars' | 'months' | 'units';

export type MemberPackageStatus = 'active' | 'exhausted' | 'expired' | 'cancelled';

export interface ShopTerms {
  kind: ShopPlanKind;
  purchasable: boolean;
  frequency?: 'monthly' | 'quarterly' | 'annual';
}

export interface MembershipLayerRow {
  id?: string;
  status: string;
  plan_id: string;
  sponsor_id?: string | null;
  layer?: string | null;
  custom_fields?: unknown;
  effective_date?: string | null;
}

export interface ShopCatalogPlan {
  id: string;
  name: string;
  code: string;
  monthly_share: number | null;
  description: string | null;
  frequency: 'monthly' | 'quarterly' | 'annual';
}

export interface ShopCatalogPackage {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  tax_rate: number;
  units: number;
  unit_label: string;
  entitlement_kind: PackageEntitlementKind;
}

export interface ShopCartItemInput {
  item_type: 'plan' | 'package';
  plan_id?: string | null;
  package_id?: string | null;
  quantity?: number;
}

export interface PackageRedeemPlan {
  remaining: number;
  status: MemberPackageStatus;
  deferred_remaining: number;
}
