/**
 * Curated lab partner catalog for the member portal.
 * Own Your Labs (OYL) and Health Cost Labs are linked from /services/labs.
 */

export const OYL_BASE_URL = 'https://ownyourlabs.com/';
export const HEALTH_COST_LABS_URL = 'https://www.healthcostlabs.com/';

/** UTM params for member-portal attribution (safe on external partner sites). */
export function partnerUrl(base: string, content: string): string {
  const url = new URL(base);
  url.searchParams.set('utm_source', 'doublehelixhub');
  url.searchParams.set('utm_medium', 'member_portal');
  url.searchParams.set('utm_campaign', 'labs');
  url.searchParams.set('utm_content', content);
  return url.toString();
}

export interface LabPartnerDefinition {
  /** Stable React key when not yet seeded in DB */
  id: string;
  name: string;
  description: string;
  external_url: string;
  logo_url: string | null;
  sort_order: number;
}

export interface RecommendedLabItem {
  id: string;
  name: string;
  description: string;
  priceLabel: string | null;
  href: string;
  kind: 'test' | 'bundle';
}

/** Fallback partners shown when `service_providers` has no labs rows for the org. */
export const DEFAULT_LAB_PARTNERS: LabPartnerDefinition[] = [
  {
    id: 'default-own-your-labs',
    name: 'Own Your Labs',
    description:
      'Affordable direct-to-consumer blood tests. Order online, draw at your local Labcorp®, view results securely.',
    external_url: OYL_BASE_URL,
    logo_url: null,
    sort_order: 10,
  },
  {
    id: 'default-health-cost-labs',
    name: 'Health Cost Labs',
    description:
      'Discount lab testing to help members find affordable blood work and diagnostic panels.',
    external_url: HEALTH_COST_LABS_URL,
    logo_url: null,
    sort_order: 20,
  },
];

/** Popular individual tests on OYL — prices from ownyourlabs.com (Jun 2026). */
export const RECOMMENDED_LAB_TESTS: RecommendedLabItem[] = [
  {
    id: 'lipid-panel',
    name: 'Lipid Panel',
    description:
      'Cholesterol and triglycerides to evaluate cardiovascular health and heart disease risk.',
    priceLabel: '$10.00',
    href: partnerUrl(OYL_BASE_URL, 'lipid_panel'),
    kind: 'test',
  },
  {
    id: 'hemoglobin-a1c',
    name: 'Hemoglobin A1c',
    description:
      'Long-term blood glucose control — useful for diabetes screening and monitoring.',
    priceLabel: '$8.80',
    href: partnerUrl(OYL_BASE_URL, 'hemoglobin_a1c'),
    kind: 'test',
  },
  {
    id: 'cmp-14',
    name: 'Comprehensive Metabolic Panel (14)',
    description:
      'Glucose, electrolytes, kidney and liver function — a broad metabolic health snapshot.',
    priceLabel: '$10.00',
    href: partnerUrl(OYL_BASE_URL, 'cmp_14'),
    kind: 'test',
  },
];

/** Curated OYL bundles for common member wellness workflows. */
export const RECOMMENDED_LAB_BUNDLES: RecommendedLabItem[] = [
  {
    id: 'basics-bundle',
    name: 'Basics Bundle',
    description: 'Our most popular tests combined — great for an annual wellness check-in.',
    priceLabel: null,
    href: partnerUrl(OYL_BASE_URL, 'basics_bundle'),
    kind: 'bundle',
  },
  {
    id: 'thyroid-bundle',
    name: 'Thyroid Check-In Bundle',
    description: 'Basic thyroid function panel including antibodies.',
    priceLabel: null,
    href: partnerUrl(OYL_BASE_URL, 'thyroid_bundle'),
    kind: 'bundle',
  },
  {
    id: 'heart-health-bundle',
    name: 'Heart Health Advanced Plus',
    description:
      'Comprehensive heart-health markers: lipids, diabetes, inflammation, and key nutrients.',
    priceLabel: null,
    href: partnerUrl(OYL_BASE_URL, 'heart_health_advanced_plus'),
    kind: 'bundle',
  },
];

/** Rows for `service_providers` seed script (idempotent by external_url). */
export const LAB_PROVIDER_SEED_ROWS = DEFAULT_LAB_PARTNERS.map((p) => ({
  category: 'labs' as const,
  name: p.name,
  description: p.description,
  external_url: p.external_url,
  sso_kind: 'none' as const,
  sort_order: p.sort_order,
  is_active: true,
  plan_filters: {},
  sso_config: {},
}));
