/**
 * Persist the record-detail Sections rail (left of the field stack).
 *
 * Default is open — the rail is the only section jump UI, so hiding it
 * on first visit would bury Profile / Notes / Coverage. Collapse is
 * remembered for this browser so a power user who wants the extra
 * field width does not fight the default every record.
 */

export const RECORD_SECTION_RAIL_STORAGE_KEY = 'crm.record-section-rail.open';

/** Default open so every group + subsection is visible without a click. */
export const RECORD_SECTION_RAIL_DEFAULT_OPEN = true;

/** Pure decode of a stored value (`'1'` / `'0'`); anything else → default. */
export function parseRecordSectionRailOpen(raw: string | null | undefined): boolean {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return RECORD_SECTION_RAIL_DEFAULT_OPEN;
}

export function readRecordSectionRailOpen(): boolean {
  if (typeof window === 'undefined') return RECORD_SECTION_RAIL_DEFAULT_OPEN;
  try {
    return parseRecordSectionRailOpen(
      window.localStorage.getItem(RECORD_SECTION_RAIL_STORAGE_KEY),
    );
  } catch {
    return RECORD_SECTION_RAIL_DEFAULT_OPEN;
  }
}

const listeners = new Set<() => void>();

export function subscribeRecordSectionRailOpen(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', listener);
  };
}

export function writeRecordSectionRailOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECORD_SECTION_RAIL_STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* quota / private mode */
  }
  listeners.forEach((l) => l());
}
