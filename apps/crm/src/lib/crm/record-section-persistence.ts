/** Session-scoped UI state so inline saves / RSC refresh don't reset the rep's place. */

const expandedKey = (recordId: string) => `crm.record.${recordId}.expandedSections`;
const activeSectionKey = (recordId: string) => `crm.record.${recordId}.activeSection`;
const scrollKey = (recordId: string) => `crm.record.${recordId}.scrollTop`;

function readJsonArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function getPersistedExpandedSections(recordId: string): Set<string> {
  return new Set(readJsonArray(expandedKey(recordId)));
}

export function persistSectionExpanded(
  recordId: string,
  sectionKey: string,
  expanded: boolean,
): void {
  if (typeof window === 'undefined') return;
  const set = getPersistedExpandedSections(recordId);
  if (expanded) set.add(sectionKey);
  else set.delete(sectionKey);
  try {
    window.sessionStorage.setItem(expandedKey(recordId), JSON.stringify([...set]));
  } catch {
    /* private mode / quota */
  }
}

export function getPersistedActiveSection(recordId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(activeSectionKey(recordId));
  } catch {
    return null;
  }
}

export function persistActiveSection(recordId: string, sectionKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(activeSectionKey(recordId), sectionKey);
  } catch {
    /* ignore */
  }
}

export function persistRecordScrollTop(recordId: string, scrollTop: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(scrollKey(recordId), String(Math.round(scrollTop)));
  } catch {
    /* ignore */
  }
}

export function consumePersistedScrollTop(recordId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(scrollKey(recordId));
    if (raw == null) return null;
    window.sessionStorage.removeItem(scrollKey(recordId));
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
