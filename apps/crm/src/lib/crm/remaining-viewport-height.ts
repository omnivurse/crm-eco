/** Shared fill-remaining-viewport math for the filter rail and record table. */

export const VIEWPORT_FILL_MIN = 240;
/** Shell bottom bar + <main> padding so the card does not sit under Smart Chat. */
export const VIEWPORT_FILL_BOTTOM_GAP = 56;
/** Both panes use this so the list is tall enough to scroll. */
export const VIEWPORT_FILL_SCALE = 2;

/**
 * Height for the filter rail and records card. Same number for both columns.
 * Scaled so the list is long enough to scroll instead of clipping mid-page.
 */
export function remainingViewportHeight(
  top: number,
  viewportHeight: number,
  bottomGap = VIEWPORT_FILL_BOTTOM_GAP,
): number {
  const remaining = viewportHeight - top - bottomGap;
  return Math.max(VIEWPORT_FILL_MIN, Math.round(remaining * VIEWPORT_FILL_SCALE));
}
