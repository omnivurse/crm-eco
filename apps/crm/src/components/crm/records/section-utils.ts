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

export interface SectionMeta {
  key: string;
  label: string;
  fieldCount: number;
  accent?: LayoutSectionAccent;
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
        label: sectionKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        columns: 2,
      });
    }
  }

  return allSections
    .filter((s) => (grouped[s.key]?.length ?? 0) > 0)
    .map((s) => ({
      key: s.key,
      label: s.label,
      fieldCount: grouped[s.key]?.length ?? 0,
      accent: s.accent,
    }));
}
