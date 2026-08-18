import { describe, expect, it } from 'vitest';
import {
  HEADER_COMPACT_ENTER,
  HEADER_COMPACT_EXIT,
  nextHeaderCompact,
  reanchorScrollAfterHeaderResize,
  type CompactTransition,
} from './record-header-compact';

/**
 * Pre-fix formula from RecordDetailShellV2. Kept here so the notes-scroll
 * loop stays red-capable against the regression that shipped.
 */
function legacyReanchor(args: {
  scrollTop: number;
  delta: number;
  transition: CompactTransition;
}): number {
  const { scrollTop, delta, transition } = args;
  if (Math.abs(delta) < 1) return scrollTop;
  if (transition === 'compacting') {
    return Math.max(HEADER_COMPACT_EXIT + 1, scrollTop + delta);
  }
  if (transition === 'expanding') {
    return 0;
  }
  return Math.max(0, scrollTop + delta);
}

type CompactState = {
  scrollTop: number;
  compact: boolean;
  transition: CompactTransition;
};

function applyUserScroll(state: CompactState, nextTop: number): CompactState {
  const next = nextHeaderCompact(state.compact, nextTop);
  return {
    scrollTop: nextTop,
    compact: next.compact,
    transition: next.transition === 'none' ? state.transition : next.transition,
  };
}

function applyHeaderResize(
  state: CompactState,
  delta: number,
  reanchor: typeof reanchorScrollAfterHeaderResize,
): CompactState {
  const scrollTop = reanchor({
    scrollTop: state.scrollTop,
    delta,
    transition: state.transition,
    headerCompact: state.compact,
  });
  const next = nextHeaderCompact(state.compact, scrollTop);
  return {
    scrollTop,
    compact: next.compact,
    transition: next.transition,
  };
}

/**
 * Client report: on a contact Notes tab, a modest wheel to read the rest of
 * the newest (first) note skips back to the top. Header shrinks ~280px when
 * breadcrumb / tags / convert collapse; ResizeObserver then settles another
 * 40px as the compact header wraps.
 */
function simulateNotesFirstNoteScroll(
  reanchor: typeof reanchorScrollAfterHeaderResize,
): CompactState {
  let state: CompactState = { scrollTop: 0, compact: false, transition: 'none' };
  state = applyUserScroll(state, HEADER_COMPACT_ENTER + 8);
  state = applyHeaderResize(state, -280, reanchor);
  state = applyHeaderResize(state, -40, reanchor);
  return state;
}

describe('nextHeaderCompact', () => {
  it('collapses only after ENTER and expands only at or below EXIT', () => {
    expect(nextHeaderCompact(false, HEADER_COMPACT_ENTER).compact).toBe(false);
    expect(nextHeaderCompact(false, HEADER_COMPACT_ENTER + 1).compact).toBe(true);
    expect(nextHeaderCompact(true, HEADER_COMPACT_EXIT + 1).compact).toBe(true);
    expect(nextHeaderCompact(true, HEADER_COMPACT_EXIT).compact).toBe(false);
  });
});

describe('legacy compact re-anchor (the notes skip)', () => {
  it('yanks a notes reader back to the top after compact + settle', () => {
    const end = simulateNotesFirstNoteScroll((args) =>
      legacyReanchor({
        scrollTop: args.scrollTop,
        delta: args.delta,
        transition: args.transition,
      }),
    );
    expect(end.scrollTop).toBe(0);
    expect(end.compact).toBe(false);
  });
});

describe('reanchorScrollAfterHeaderResize', () => {
  it('lets the user keep scrolling a long first note after the hero compacts', () => {
    const end = simulateNotesFirstNoteScroll(reanchorScrollAfterHeaderResize);
    expect(end.scrollTop).toBeGreaterThan(HEADER_COMPACT_EXIT);
    expect(end.compact).toBe(true);
  });

  it('parks compacting above ENTER so a settle cannot un-compact', () => {
    expect(
      reanchorScrollAfterHeaderResize({
        scrollTop: HEADER_COMPACT_ENTER + 8,
        delta: -280,
        transition: 'compacting',
        headerCompact: true,
      }),
    ).toBe(HEADER_COMPACT_ENTER + 1);
  });

  it('does not force 0 when the hero expands', () => {
    expect(
      reanchorScrollAfterHeaderResize({
        scrollTop: HEADER_COMPACT_EXIT,
        delta: 280,
        transition: 'expanding',
        headerCompact: false,
      }),
    ).toBe(HEADER_COMPACT_EXIT);
  });

  it('keeps mid-page content stable on a non-compact resize', () => {
    expect(
      reanchorScrollAfterHeaderResize({
        scrollTop: 640,
        delta: -48,
        transition: 'none',
        headerCompact: false,
      }),
    ).toBe(592);
  });
});
