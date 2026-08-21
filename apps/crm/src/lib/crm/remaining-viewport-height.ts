/** Shared fill-remaining-viewport math for the filter rail and record table. */

export const VIEWPORT_FILL_MIN = 240;
/** Shell bottom bar + <main> padding so the card does not sit under Smart Chat. */
export const VIEWPORT_FILL_BOTTOM_GAP = 56;

/**
 * Height that fills from `top` (getBoundingClientRect) down to the visible
 * bottom of the window. Both the docked filter rail and the records card
 * must use this — a full-`dvh` rail sitting below the toolbar outgrows the
 * table and leaves a gray gap beside it.
 */
export function remainingViewportHeight(
  top: number,
  viewportHeight: number,
  bottomGap = VIEWPORT_FILL_BOTTOM_GAP,
): number {
  return Math.max(VIEWPORT_FILL_MIN, Math.round(viewportHeight - top - bottomGap));
}
