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

/** Default heading for extra sections inferred only from {@link CrmField.section}. */
export function fallbackSectionHeadingFromFieldSection(sectionKey: string): string {
  if (sectionKey === 'insurance') return 'HealthShare';
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
): SectionMeta[] {
  const layoutConfig: LayoutConfig = layout?.config || { sections: [{ key: 'main', label: 'Information', columns: 2 }] };

  // Group fields by section
  const grouped: Record<string, CrmField[]> = {};
  for (const field of fields) {
    const section = field.section || 'main';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(field);
  }

  // Build section list from layout, then append any extras
  const layoutSections = layoutConfig.sections || [{ key: 'main', label: 'General', columns: 2 }];
  const coveredKeys = new Set(layoutSections.map((s: LayoutSection) => s.key));

  const allSections: LayoutSection[] = [...layoutSections];
  for (const sectionKey of Object.keys(grouped)) {
    if (!coveredKeys.has(sectionKey)) {
      allSections.push({
        key: sectionKey,
        label: fallbackSectionHeadingFromFieldSection(sectionKey),
        columns: 2,
      });
    }
  }

  return allSections
    .filter((s) => (grouped[s.key]?.length ?? 0) > 0)
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
        accent: s.accent,
      };
    });
}
