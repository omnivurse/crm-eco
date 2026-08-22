/**
 * Sticky-header compact thresholds and scroll re-anchor.
 *
 * The record hero is in-flow (`position: sticky`). Shrinking it shortens the
 * document; Chromium leaves scrollTop alone (`overflow-anchor: none`), so we
 * compensate. The compensation must never yank a notes reader back to 0 —
 * that is the "can't scroll the first note" bounce.
 */

/** Scroll past this (px) to collapse the hero. */
export const HEADER_COMPACT_ENTER = 72;
/** Scroll back to this (px) to expand the hero. Wide gap vs ENTER avoids flicker. */
export const HEADER_COMPACT_EXIT = 12;

export type CompactTransition = 'none' | 'compacting' | 'expanding';

/**
 * Notes / related panes / timeline must not toggle the hero mid-read.
 * A modest wheel to read the first note used to compact the header (~280px)
 * and skip the list. Lock compact so ResizeObserver never re-anchors.
 */
export function lockRecordHeaderCompact(args: {
  topTab: string;
  overviewPane: string;
}): boolean {
  return args.topTab !== 'overview' || args.overviewPane !== 'details';
}

/**
 * The document under the sticky header is new after a pane/tab switch.
 * Keep leftover Details scrollTop and the chip-strip grow compensation
 * would land the user halfway down the notes list.
 */
export function scrollTopAfterRecordChromeChange(args: {
  prevPane: string;
  nextPane: string;
  prevTab?: string;
  nextTab?: string;
  prevScrollTop: number;
}): number {
  const prevTab = args.prevTab ?? 'overview';
  const nextTab = args.nextTab ?? 'overview';
  if (args.prevPane === args.nextPane && prevTab === nextTab) {
    return Math.max(0, args.prevScrollTop);
  }
  return 0;
}

export function nextHeaderCompact(
  prevCompact: boolean,
  scrollTop: number,
): { compact: boolean; transition: CompactTransition } {
  if (!prevCompact && scrollTop > HEADER_COMPACT_ENTER) {
    return { compact: true, transition: 'compacting' };
  }
  if (prevCompact && scrollTop <= HEADER_COMPACT_EXIT) {
    return { compact: false, transition: 'expanding' };
  }
  return { compact: prevCompact, transition: 'none' };
}

export function reanchorScrollAfterHeaderResize(args: {
  scrollTop: number;
  delta: number;
  transition: CompactTransition;
  headerCompact: boolean;
}): number {
  const { scrollTop, delta, transition, headerCompact } = args;
  if (!Number.isFinite(scrollTop) || !Number.isFinite(delta)) {
    return Math.max(0, scrollTop || 0);
  }
  if (Math.abs(delta) < 1) return scrollTop;

  const compensated = scrollTop + delta;

  if (transition === 'compacting') {
    // Park above ENTER, not EXIT. EXIT+1 sits 1px from expand and the next
    // ResizeObserver settle (chips wrap, fonts) drops through and snaps to top.
    return Math.max(HEADER_COMPACT_ENTER + 1, compensated);
  }

  if (transition === 'expanding') {
    // Compensate the grow, but never force 0 (that is the skip-to-top) and
    // never land back above EXIT (that would re-compact).
    return Math.min(HEADER_COMPACT_EXIT, Math.max(0, compensated));
  }

  // Follow-up header settle (not the compact toggle). A shrink that would
  // cross EXIT while compact is what bounced notes readers to the top.
  if (headerCompact && compensated <= HEADER_COMPACT_EXIT) {
    return Math.max(HEADER_COMPACT_ENTER + 1, scrollTop);
  }

  return Math.max(0, compensated);
}
