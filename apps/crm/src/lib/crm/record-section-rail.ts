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

/**
 * Remaining viewport below a sticky rail, so Coverage → Vision (and Admin /
 * More) stay inside a real scrollport. `max-height` alone on a flex parent
 * does not shrink the child — the list clips and wheel-scrolls the record
 * instead of the rail.
 */
export function computeRecordSectionRailMaxHeight(input: {
  railTop: number;
  viewportHeight: number;
  bottomPad?: number;
  minHeight?: number;
}): number {
  const bottomPad = input.bottomPad ?? 16;
  const minHeight = input.minHeight ?? 160;
  return Math.max(minHeight, Math.floor(input.viewportHeight - input.railTop - bottomPad));
}

/** Scroll `child` inside `container` without moving ancestor scrollers. */
export function scrollChildIntoNearest(container: HTMLElement, child: HTMLElement): void {
  const c = container.getBoundingClientRect();
  const t = child.getBoundingClientRect();
  if (t.top < c.top) {
    container.scrollTop -= c.top - t.top;
    return;
  }
  if (t.bottom > c.bottom) {
    container.scrollTop += t.bottom - c.bottom;
  }
}
