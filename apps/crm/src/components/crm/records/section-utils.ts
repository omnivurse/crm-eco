/**
 * Shared section utilities — safe for both server and client components.
 */

import type {
  CrmField,
  CrmLayout,
  FieldCarrierType,
  LayoutSection,
  LayoutConfig,
  LayoutSectionAccent,
  LayoutSectionVariant,
} from '@/lib/crm/types';

// ---------------------------------------------------------------------------
// Carrier / Ministry terminology helper
// ---------------------------------------------------------------------------

export interface CarrierTerms {
  /** e.g. "Carrier" or "Ministry" */
  singular: string;
  /** e.g. "Carriers" or "Ministries" */
  plural: string;
  /** Lowercase singular, e.g. "carrier" or "ministry" */
  singularLower: string;
  /** Lowercase plural, e.g. "carriers" or "ministries" */
  pluralLower: string;
}

/**
 * Return the correct user-facing noun for a given carrier type.
 *
 * - `healthshare` → **Ministry / Ministries** (health sharing organizations
 *   like Sedera, Zion, MPB are ministries, not carriers)
 * - everything else → **Carrier / Carriers**
 */
export function getCarrierTerms(carrierType?: FieldCarrierType | string | null): CarrierTerms {
  if (carrierType === 'healthshare') {
    return {
      singular: 'Ministry',
      plural: 'Ministries',
      singularLower: 'ministry',
      pluralLower: 'ministries',
    };
  }
  return {
    singular: 'Carrier',
    plural: 'Carriers',
    singularLower: 'carrier',
    pluralLower: 'carriers',
  };
}

/** Fired when the user taps an Overview section pill; accordion expands before scroll targets `#section-{key}`. */
export const CRM_SECTION_NAV_EVENT = 'crm-record-section-navigate' as const;

/**
 * Canonical top-to-bottom order for person-module record sections. Matches the
 * product layout (Name → Notes → coverage → address → admin) so nav pills and
 * on-page cards stay in sync regardless of DB layout JSON order or field seed
 * insertion order.
 */
export const PERSON_SECTION_DISPLAY_ORDER: readonly string[] = [
  'core',
  'main',
  'notes_history',
  'notes',
  'start_date',
  'health_sharing',
  'insurance',
  'insurance_coverage',
  'health_insurance',
  'dental_coverage',
  'vision_coverage',
  'other_coverage',
  'life_coverage',
  'family',
  'address',
  'management',
  'payment',
  'identifiers',
  'portal',
  'compliance',
  'fulfillment',
  'business',
  'preferences',
  'additional',
  'activity',
  'commissions',
  'product',
  'conversion',
  'zoho_system',
  'system',
];

/** Deal / pipeline modules — amount & stage before notes. */
export const DEAL_SECTION_DISPLAY_ORDER: readonly string[] = [
  'core',
  'main',
  'deal',
  'amounts',
  'pipeline',
  'stage',
  'products',
  'contacts',
  'notes_history',
  'notes',
  'management',
  'address',
  'activity',
  'system',
];

/** Account / company records. */
export const ACCOUNT_SECTION_DISPLAY_ORDER: readonly string[] = [
  'core',
  'main',
  'business',
  'address',
  'contacts',
  'deals',
  'notes_history',
  'notes',
  'management',
  'payment',
  'activity',
  'system',
];

/** Generic fallback for tickets, providers, custom modules. */
export const DEFAULT_SECTION_DISPLAY_ORDER: readonly string[] = [
  'core',
  'main',
  'notes_history',
  'notes',
  'address',
  'management',
  'payment',
  'activity',
  'additional',
  'system',
  'zoho_system',
];

const MODULE_SECTION_ORDERS: Record<string, readonly string[]> = {
  contacts: PERSON_SECTION_DISPLAY_ORDER,
  leads: PERSON_SECTION_DISPLAY_ORDER,
  members: PERSON_SECTION_DISPLAY_ORDER,
  deals: DEAL_SECTION_DISPLAY_ORDER,
  accounts: ACCOUNT_SECTION_DISPLAY_ORDER,
};

/** Visual grouping for section nav — mirrors Zoho's logical field bands. */
export type SectionNavGroup = 'identity' | 'notes' | 'coverage' | 'location' | 'admin' | 'other';

const SECTION_NAV_GROUP_LABELS: Record<SectionNavGroup, string> = {
  identity: 'Profile',
  notes: 'Notes',
  coverage: 'Coverage',
  location: 'Location',
  admin: 'Admin',
  other: 'More',
};

export function getSectionDisplayOrder(moduleKey?: string | null): readonly string[] {
  if (moduleKey && MODULE_SECTION_ORDERS[moduleKey]) {
    return MODULE_SECTION_ORDERS[moduleKey];
  }
  return DEFAULT_SECTION_DISPLAY_ORDER;
}

export function getSectionNavGroup(sectionKey: string): SectionNavGroup {
  if (['core', 'main', 'start_date'].includes(sectionKey)) return 'identity';
  if (['notes_history', 'notes'].includes(sectionKey)) return 'notes';
  if (
    isPersonCoverageSectionKey(sectionKey) ||
    ['product', 'conversion', 'deal', 'amounts', 'pipeline', 'stage', 'products'].includes(sectionKey)
  ) {
    return 'coverage';
  }
  if (['address', 'family', 'contacts', 'deals'].includes(sectionKey)) return 'location';
  if (
    [
      'management',
      'payment',
      'identifiers',
      'portal',
      'compliance',
      'fulfillment',
      'business',
      'preferences',
      'additional',
      'activity',
      'commissions',
      'zoho_system',
      'system',
    ].includes(sectionKey)
  ) {
    return 'admin';
  }
  return 'other';
}

export function getSectionNavGroupLabel(group: SectionNavGroup): string {
  return SECTION_NAV_GROUP_LABELS[group];
}

/**
 * Semantic accent for each section key — coverage types get distinct hues,
 * identity/notes/address/admin groups stay consistent. Overrides stale or
 * missing layout JSON accents so pills and cards always match.
 */
export const SECTION_ACCENT_BY_KEY: Partial<Record<string, LayoutSectionAccent>> = {
  core: 'blue',
  main: 'blue',
  notes_history: 'sky',
  notes: 'sky',
  start_date: 'indigo',
  health_sharing: 'emerald',
  insurance: 'teal',
  insurance_coverage: 'blue',
  health_insurance: 'blue',
  dental_coverage: 'cyan',
  vision_coverage: 'purple',
  other_coverage: 'amber',
  life_coverage: 'rose',
  family: 'pink',
  address: 'teal',
  management: 'violet',
  payment: 'lime',
  identifiers: 'slate',
  portal: 'fuchsia',
  compliance: 'orange',
  fulfillment: 'amber',
  business: 'slate',
  preferences: 'sky',
  additional: 'slate',
  activity: 'violet',
  commissions: 'lime',
  product: 'blue',
  conversion: 'emerald',
  zoho_system: 'slate',
  system: 'slate',
  deal: 'violet',
  amounts: 'lime',
  pipeline: 'indigo',
  stage: 'purple',
  products: 'blue',
  contacts: 'teal',
};

/** Sort section keys: canonical order first, then alphabetical for unknowns. */
export function compareSectionOrder(
  a: string,
  b: string,
  moduleKey?: string | null,
): number {
  const order = getSectionDisplayOrder(moduleKey);
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
  const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
  if (aRank !== bRank) return aRank - bRank;
  return a.localeCompare(b);
}

/** Resolve the accent shown in nav pills and section cards. */
export function resolveSectionAccent(
  sectionKey: string,
  layoutAccent?: LayoutSectionAccent,
): LayoutSectionAccent {
  return SECTION_ACCENT_BY_KEY[sectionKey] ?? layoutAccent ?? 'slate';
}

/**
 * Merge layout sections with field-only extras, normalize labels, apply semantic
 * accents, and sort into canonical display order.
 */
export function buildEffectiveSections(
  layoutConfig: LayoutConfig | undefined | null,
  fieldSectionKeys: Iterable<string>,
  moduleKey?: string | null,
): LayoutSection[] {
  const layoutSections = layoutConfig?.sections ?? [{ key: 'main', label: 'General', columns: 2 as const }];
  const coveredKeys = new Set(layoutSections.map((s) => s.key));

  const extraSections: LayoutSection[] = [];
  for (const sectionKey of fieldSectionKeys) {
    if (!coveredKeys.has(sectionKey)) {
      extraSections.push({
        key: sectionKey,
        label: fallbackSectionHeadingFromFieldSection(sectionKey),
        columns: 2,
      });
    }
  }

  return [...layoutSections, ...extraSections]
    .map((s) => ({
      ...s,
      label: normalizeLegacySectionHeading(s.key, s.label),
      accent: resolveSectionAccent(s.key, s.accent),
    }))
    .sort((a, b) => compareSectionOrder(a.key, b.key, moduleKey));
}

export interface SectionMeta {
  key: string;
  label: string;
  /** Total fields configured in this section. */
  fieldCount: number;
  /**
   * Fields with a non-empty value on the current record. When `recordData`
   * isn't supplied this falls back to `fieldCount` so callers without record
   * context still render a number. The pill in the section nav prefers this
   * because reps care about what's actually filled in, not what's possible.
   */
  filledCount: number;
  accent?: LayoutSectionAccent;
  variant?: LayoutSectionVariant;
  navGroup: SectionNavGroup;
}

export interface SectionMetaOptions {
  /** When true, nav includes empty editable sections (matches inline overview). */
  inlineEditable?: boolean;
}

/** Whether a section should appear in nav + on-page stack for this record. */
export function shouldIncludeSectionInNav(
  section: LayoutSection,
  sectionFields: CrmField[],
  recordData: Record<string, unknown> | null | undefined,
  moduleKey: string | undefined | null,
  inlineEditable: boolean,
): boolean {
  if (section.variant === 'hero') return true;
  if (shouldAlwaysShowEmptySection(moduleKey, section.key, inlineEditable)) return true;
  if (sectionFields.length === 0) return false;
  if (inlineEditable) return true;
  if (!recordData) return sectionFields.length > 0;
  return sectionFields.some((f) => isPopulated(recordData[f.key]));
}

/**
 * Legacy slug `insurance` (Zoho/import era) carries HealthShare-centric product/carrier/start rows
 * for PIF deployments. Labels like "Insurance" are misleading compared to newer `insurance_coverage`
 * wording — prefer HealthShare when the layout uses a generic insurance title so nav + overview match.
 *
 * Leaves custom titles alone (anything that doesn't start with "Insurance", case-insensitive).
 */
export function normalizeLegacySectionHeading(key: string, label: string): string {
  if (key !== 'insurance') return label;
  const t = label.trim();
  if (t === '') return 'HealthShare';
  if (/^insurance\b/i.test(t)) return 'HealthShare';
  return label;
}

function titleCaseSectionKey(sectionKey: string): string {
  return sectionKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Modules where reps enter / edit coverage after lead conversion. */
export const PERSON_MODULE_KEYS = ['contacts', 'leads', 'members'] as const;

/**
 * Sections that must stay visible (and editable) even when every field is blank.
 * Without this, read-only detail views collapse empty cards to 1px anchors and
 * reps cannot add insurance / HealthShare data on freshly converted contacts.
 */
export const PERSON_COVERAGE_SECTION_KEYS = [
  'health_sharing',
  'health_insurance',
  'insurance',
  'insurance_coverage',
  'dental_coverage',
  'vision_coverage',
  'other_coverage',
  'life_coverage',
  'product',
] as const;

export function isPersonModuleKey(moduleKey?: string | null): boolean {
  if (!moduleKey) return false;
  return (PERSON_MODULE_KEYS as readonly string[]).includes(moduleKey);
}

export function isPersonCoverageSectionKey(sectionKey: string): boolean {
  return (PERSON_COVERAGE_SECTION_KEYS as readonly string[]).includes(sectionKey);
}

/** Whether an empty section card should still render on the record detail view. */
export function shouldAlwaysShowEmptySection(
  moduleKey: string | undefined | null,
  sectionKey: string,
  inlineEditable: boolean,
): boolean {
  if (inlineEditable) return true;
  return isPersonModuleKey(moduleKey) && isPersonCoverageSectionKey(sectionKey);
}

/** Default heading for extra sections inferred only from {@link CrmField.section}. */
export function fallbackSectionHeadingFromFieldSection(sectionKey: string): string {
  // Legacy Zoho `insurance` holds product / premium / date rows — not the same as `health_sharing`.
  if (sectionKey === 'insurance') return 'Membership & Product';
  if (sectionKey === 'health_sharing') return 'HealthShare';
  return titleCaseSectionKey(sectionKey);
}

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

/**
 * Compute section metadata from fields + layout.
 * Returns the list of sections with field counts, filtering out empty ones.
 *
 * `recordData` is the merged form-defaults map (JSONB `data` overlaid with
 * indexed columns) — when supplied, each section reports the count of fields
 * whose value is actually populated. Reps see "(3)" instead of "(26)" so the
 * number reflects what's filled in, not what's possible.
 */
export function getSectionMeta(
  fields: CrmField[],
  layout?: CrmLayout | null,
  recordData?: Record<string, unknown> | null,
  moduleKey?: string | null,
  options?: SectionMetaOptions,
): SectionMeta[] {
  const inlineEditable = options?.inlineEditable ?? false;
  const layoutConfig: LayoutConfig = layout?.config || { sections: [{ key: 'main', label: 'Information', columns: 2 }] };

  // Group fields by section
  const grouped: Record<string, CrmField[]> = {};
  for (const field of fields) {
    const section = field.section || 'main';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(field);
  }

  const allSections = buildEffectiveSections(layoutConfig, Object.keys(grouped), moduleKey);

  return allSections
    .filter((s) =>
      shouldIncludeSectionInNav(
        s,
        grouped[s.key] ?? [],
        recordData,
        moduleKey,
        inlineEditable,
      ),
    )
    .map((s) => {
      const sectionFields = grouped[s.key] ?? [];
      const fieldCount = sectionFields.length;
      const filledCount = recordData
        ? sectionFields.filter((f) => isPopulated(recordData[f.key])).length
        : fieldCount;
      return {
        key: s.key,
        label: normalizeLegacySectionHeading(s.key, s.label),
        fieldCount,
        filledCount,
        accent: resolveSectionAccent(s.key, s.accent),
        variant: s.variant,
        navGroup: getSectionNavGroup(s.key),
      };
    });
}
