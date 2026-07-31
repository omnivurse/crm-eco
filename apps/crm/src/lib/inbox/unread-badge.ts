/**
 * How an unread count is rendered on a nav badge.
 *
 * Separate from the hook because the edge cases are worth pinning down: a
 * badge showing "0" is worse than no badge (it draws the eye to nothing), and
 * an unbounded number breaks a narrow sidebar the moment a queue backs up.
 */

/** Above this, the exact number stops being actionable. */
export const UNREAD_BADGE_CAP = 99;

/**
 * Badge text, or null when nothing should render.
 *
 * null (rather than "0" or "") is deliberate so callers must branch and cannot
 * accidentally render an empty pill.
 */
export function formatUnreadBadge(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;
  const whole = Math.floor(count);
  if (whole <= 0) return null;
  return whole > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(whole);
}

/** Screen-reader label; the visual badge alone reads as a bare number. */
export function unreadBadgeAriaLabel(count: number | null | undefined): string | null {
  const whole = typeof count === 'number' && Number.isFinite(count) ? Math.floor(count) : 0;
  if (whole <= 0) return null;
  return whole === 1 ? '1 unread conversation' : `${whole} unread conversations`;
}
