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

export type RecordScrollChrome = {
  pane: string;
  tab: string;
};

export type PersistedRecordScroll = RecordScrollChrome & { top: number };

/** Accepts today's JSON payload and the legacy raw-number string. */
export function parsePersistedRecordScroll(raw: string): PersistedRecordScroll | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('{')) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? { top: n, pane: 'details', tab: 'overview' } : null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const top = (parsed as { top?: unknown }).top;
    if (typeof top !== 'number' || !Number.isFinite(top)) return null;
    const pane = (parsed as { pane?: unknown }).pane;
    const tab = (parsed as { tab?: unknown }).tab;
    return {
      top,
      pane: typeof pane === 'string' && pane ? pane : 'details',
      tab: typeof tab === 'string' && tab ? tab : 'overview',
    };
  } catch {
    return null;
  }
}

export function persistRecordScrollTop(
  recordId: string,
  scrollTop: number,
  chrome?: RecordScrollChrome,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedRecordScroll = {
      top: Math.round(scrollTop),
      pane: chrome?.pane ?? 'details',
      tab: chrome?.tab ?? 'overview',
    };
    window.sessionStorage.setItem(scrollKey(recordId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumePersistedScrollTop(
  recordId: string,
  chrome?: RecordScrollChrome,
): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(scrollKey(recordId));
    if (raw == null) return null;
    const parsed = parsePersistedRecordScroll(raw);
    if (!parsed) {
      window.sessionStorage.removeItem(scrollKey(recordId));
      return null;
    }
    if (chrome && (parsed.pane !== chrome.pane || parsed.tab !== chrome.tab)) {
      return null;
    }
    window.sessionStorage.removeItem(scrollKey(recordId));
    return parsed.top;
  } catch {
    return null;
  }
}
