/**
 * Shared section utilities — safe for both server and client components.
 */

import type {
  CrmField,
  CrmLayout,
  LayoutSection,
  LayoutConfig,
  LayoutSectionAccent,
} from '@/lib/crm/types';

/** Fired when the user taps an Overview section pill; accordion expands before scroll targets `#section-{key}`. */
export const CRM_SECTION_NAV_EVENT = 'crm-record-section-navigate' as const;

export interface SectionMeta {
  key: string;
  label: string;
  fieldCount: number;
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

/**
 * Compute section metadata from fields + layout.
 * Returns the list of sections with field counts, filtering out empty ones.
 */
export function getSectionMeta(
  fields: CrmField[],
  layout?: CrmLayout | null,
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
    .map((s) => ({
      key: s.key,
      label: normalizeLegacySectionHeading(s.key, s.label),
      fieldCount: grouped[s.key]?.length ?? 0,
      accent: s.accent,
    }));
}
