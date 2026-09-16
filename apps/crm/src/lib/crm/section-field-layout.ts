/**
 * Per-section card field order — same organizer as the coverage snapshot,
 * scoped to one module type + one section so Address on Contacts never
 * clobbers Health Share or Members.
 *
 * Stored on `profiles.ui_preferences.section_field_layout` with a
 * localStorage mirror.
 */

import {
  type CoverageSnapshotLayoutPrefs,
  applyCoverageSnapshotLayout,
  normalizeCoverageSnapshotOrder,
  parseCoverageSnapshotLayout,
} from './coverage-snapshot-layout';

export const SECTION_FIELD_LAYOUT_STORAGE_PREFIX = 'crm.section-field-layout.';

export type SectionFieldPrefs = CoverageSnapshotLayoutPrefs;
export type ModuleSectionFieldMap = Record<string, SectionFieldPrefs>;
export type SectionFieldLayoutMap = Record<string, ModuleSectionFieldMap>;

export function sectionFieldLayoutStorageKey(moduleKey: string): string {
  return `${SECTION_FIELD_LAYOUT_STORAGE_PREFIX}${moduleKey.trim()}`;
}

export function parseModuleSectionFieldMap(raw: unknown): ModuleSectionFieldMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const rec = raw as Record<string, unknown>;
  const out: ModuleSectionFieldMap = {};
  for (const [key, value] of Object.entries(rec)) {
    const sectionKey = key.trim();
    if (!sectionKey) continue;
    const parsed = parseCoverageSnapshotLayout(value);
    if (parsed) out[sectionKey] = parsed;
  }
  return out;
}

export function parseSectionFieldLayoutMap(raw: unknown): SectionFieldLayoutMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const rec = raw as Record<string, unknown>;
  const out: SectionFieldLayoutMap = {};
  for (const [key, value] of Object.entries(rec)) {
    const moduleKey = key.trim();
    if (!moduleKey) continue;
    const sections = parseModuleSectionFieldMap(value);
    if (Object.keys(sections).length > 0) out[moduleKey] = sections;
  }
  return out;
}

export function mergeSectionFieldLayout(
  current: unknown,
  moduleKey: string,
  sectionKey: string,
  prefs: SectionFieldPrefs | null,
): SectionFieldLayoutMap {
  const map = parseSectionFieldLayoutMap(current);
  const mk = moduleKey.trim();
  const sk = sectionKey.trim();
  if (!mk || !sk) return map;
  const sections: ModuleSectionFieldMap = { ...(map[mk] ?? {}) };
  if (!prefs || (prefs.order.length === 0 && prefs.hidden.length === 0)) {
    delete sections[sk];
  } else {
    sections[sk] = prefs;
  }
  const next: SectionFieldLayoutMap = { ...map };
  if (Object.keys(sections).length === 0) delete next[mk];
  else next[mk] = sections;
  return next;
}

export function readSectionFieldLayout(moduleKey: string): ModuleSectionFieldMap {
  if (typeof window === 'undefined' || !moduleKey.trim()) return {};
  try {
    return parseModuleSectionFieldMap(
      JSON.parse(
        window.localStorage.getItem(sectionFieldLayoutStorageKey(moduleKey)) ?? 'null',
      ),
    );
  } catch {
    return {};
  }
}

export function writeSectionFieldLayout(
  moduleKey: string,
  sections: ModuleSectionFieldMap | null,
): void {
  if (typeof window === 'undefined' || !moduleKey.trim()) return;
  try {
    const key = sectionFieldLayoutStorageKey(moduleKey);
    if (!sections || Object.keys(sections).length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(sections));
    }
  } catch {
    /* quota / private mode */
  }
}

/** Keep the card's natural field order until she customizes it. */
export function applySectionFieldLayout<T extends { key: string; required?: boolean }>(
  fields: T[],
  prefs: SectionFieldPrefs | null,
): T[] {
  const present = fields.map((f) => f.key);
  const hidden = new Set(
    (prefs?.hidden ?? []).filter((key) => {
      const field = fields.find((f) => f.key === key);
      return !field?.required;
    }),
  );
  const visible = fields.filter((f) => !hidden.has(f.key));
  return applyCoverageSnapshotLayout(visible, {
    v: 1,
    order: normalizeCoverageSnapshotOrder(visible.map((f) => f.key), prefs?.order, present),
    hidden: [],
  });
}
