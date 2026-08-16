/**
 * Record section / field scroll helpers.
 *
 * The record detail shell scrolls inside `<main data-record-find-root>`, not
 * the window. Sticky header + section-nav sit on top of that scroller, so
 * naive `scrollIntoView()` lands the target under chrome or fires before a
 * collapsed accordion has height. These helpers expand → wait for paint →
 * scroll the container with a measured sticky offset, and suppress the
 * IntersectionObserver snap-back briefly after a programmatic jump.
 */

export const RECORD_SCROLL_ROOT_SELECTOR = '[data-record-find-root]';

/** How long OverviewLayout ignores observer updates after a pill/field jump. */
export const SECTION_JUMP_SUPPRESS_MS = 400;

let sectionJumpSuppressUntil = 0;

export function markSectionJumpProgrammatic(
  durationMs: number = SECTION_JUMP_SUPPRESS_MS,
): void {
  sectionJumpSuppressUntil = Date.now() + durationMs;
}

export function isSectionJumpSuppressed(now: number = Date.now()): boolean {
  return now < sectionJumpSuppressUntil;
}

/** Test-only reset so suites don't leak suppress windows. */
export function resetSectionJumpSuppressForTests(): void {
  sectionJumpSuppressUntil = 0;
}

export function getRecordScrollRoot(
  preferred?: Element | null,
): HTMLElement | null {
  if (preferred instanceof HTMLElement) return preferred;
  if (typeof document === 'undefined') return null;
  return document.querySelector(RECORD_SCROLL_ROOT_SELECTOR);
}

/**
 * Sticky chrome height inside the record scroller (header strip + section
 * nav pills). Prefer measured DOM over a guessed constant.
 *
 * Pure arithmetic helper also exported for unit tests — pass measured heights.
 */
export function computeRecordStickyOffset(parts: {
  headerHeight?: number;
  navHeight?: number;
  cssStickyOffsetPx?: number;
  padding?: number;
}): number {
  const pad = parts.padding ?? 8;
  const header = Math.max(0, parts.headerHeight ?? 0);
  const nav = Math.max(0, parts.navHeight ?? 0);
  const measured = header + nav;
  if (measured >= 40) return measured + pad;

  const css = parts.cssStickyOffsetPx ?? 0;
  // css var is header height + breathing room; add a typical nav strip (~40).
  if (css > 0) return css + 40 + pad;
  return 175;
}

/**
 * Sticky chrome height inside the record scroller (header strip + section
 * nav pills). Prefer measured DOM over a guessed constant.
 */
export function measureRecordStickyOffset(scrollRoot: HTMLElement): number {
  const headerEl = scrollRoot.querySelector(
    '.sticky.top-0',
  ) as HTMLElement | null;
  const navEl = scrollRoot
    .querySelector('[role="tablist"][aria-label="Record sections"]')
    ?.closest('.sticky') as HTMLElement | null;

  const cssRaw = getComputedStyle(scrollRoot)
    .getPropertyValue('--record-sticky-offset')
    .trim();
  const cssStickyOffsetPx = Number.parseFloat(cssRaw);

  return computeRecordStickyOffset({
    headerHeight: headerEl?.getBoundingClientRect().height,
    navHeight:
      navEl && navEl !== headerEl
        ? navEl.getBoundingClientRect().height
        : undefined,
    cssStickyOffsetPx: Number.isFinite(cssStickyOffsetPx)
      ? cssStickyOffsetPx
      : undefined,
  });
}

function offsetTopWithin(container: HTMLElement, el: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  // If offsetParent chain left the container (transformed ancestors), fall back
  // to getBoundingClientRect delta.
  if (!node) {
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    return eRect.top - cRect.top + container.scrollTop;
  }
  return top;
}

export interface ScrollRecordTargetOptions {
  /** Scroll container; defaults to [data-record-find-root]. */
  scrollRoot?: HTMLElement | null;
  /** Prefer 'start' for sections, 'center' for fields. */
  block?: 'start' | 'center';
  behavior?: ScrollBehavior;
  /** Extra pixels below sticky chrome. */
  extraOffset?: number;
}

/**
 * Scroll a target into view inside the record main scroller, accounting for
 * sticky header + section nav.
 */
export function scrollRecordTargetIntoView(
  target: Element | null | undefined,
  options: ScrollRecordTargetOptions = {},
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const root = getRecordScrollRoot(options.scrollRoot ?? null);
  if (!root) {
    target.scrollIntoView({
      behavior: options.behavior ?? 'smooth',
      block: options.block ?? 'start',
    });
    return true;
  }

  const sticky = measureRecordStickyOffset(root);
  const extra = options.extraOffset ?? 0;
  const topInRoot = offsetTopWithin(root, target);
  let nextTop = topInRoot - sticky - extra;

  if (options.block === 'center') {
    nextTop = topInRoot - root.clientHeight / 2 + target.offsetHeight / 2;
  }

  root.scrollTo({
    top: Math.max(0, nextTop),
    behavior: options.behavior ?? 'smooth',
  });
  return true;
}

/**
 * After expanding a collapsed section, wait for layout then scroll.
 * Uses double-rAF + a short timeout so React commit/paint has height.
 */
export function scrollRecordSectionAfterExpand(
  sectionKey: string,
  options: ScrollRecordTargetOptions & { delayMs?: number } = {},
): void {
  if (typeof window === 'undefined') return;
  markSectionJumpProgrammatic();
  const delay = options.delayMs ?? 150;

  window.setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`section-${sectionKey}`);
        scrollRecordTargetIntoView(el, {
          ...options,
          block: options.block ?? 'start',
        });
      });
    });
  }, delay);
}

/**
 * Jump to a field cell (`[data-field="…"]`) inside the record scroller.
 */
export function scrollRecordFieldIntoView(
  fieldKey: string,
  options: ScrollRecordTargetOptions & { delayMs?: number } = {},
): void {
  if (typeof window === 'undefined') return;
  markSectionJumpProgrammatic();
  const delay = options.delayMs ?? 150;
  const fk =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(fieldKey)
      : fieldKey.replace(/"/g, '\\"');
  const selector = `[data-field="${fk}"]`;

  window.setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const root = getRecordScrollRoot(options.scrollRoot ?? null);
        const el =
          root?.querySelector(selector) ?? document.querySelector(selector);
        scrollRecordTargetIntoView(el, {
          ...options,
          scrollRoot: root,
          block: options.block ?? 'center',
        });
      });
    });
  }, delay);
}
