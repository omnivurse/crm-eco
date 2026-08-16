import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeRecordStickyOffset,
  isSectionJumpSuppressed,
  markSectionJumpProgrammatic,
  resetSectionJumpSuppressForTests,
  SECTION_JUMP_SUPPRESS_MS,
} from './record-section-scroll';

describe('computeRecordStickyOffset', () => {
  it('sums header + nav when measured heights are present', () => {
    expect(
      computeRecordStickyOffset({ headerHeight: 120, navHeight: 44 }),
    ).toBe(120 + 44 + 8);
  });

  it('falls back to css sticky offset + typical nav when DOM is not ready', () => {
    expect(
      computeRecordStickyOffset({ cssStickyOffsetPx: 140 }),
    ).toBe(140 + 40 + 8);
  });

  it('uses the classic 175px guess when nothing is measurable', () => {
    expect(computeRecordStickyOffset({})).toBe(175);
  });

  it('ignores tiny measured heights that look like unlaid-out nodes', () => {
    expect(
      computeRecordStickyOffset({ headerHeight: 10, navHeight: 5 }),
    ).toBe(175);
  });
});

describe('section jump suppress', () => {
  beforeEach(() => {
    resetSectionJumpSuppressForTests();
  });

  it('marks a short suppress window after a programmatic jump', () => {
    markSectionJumpProgrammatic(SECTION_JUMP_SUPPRESS_MS);
    expect(isSectionJumpSuppressed()).toBe(true);
    expect(isSectionJumpSuppressed(Date.now() + SECTION_JUMP_SUPPRESS_MS + 50)).toBe(
      false,
    );
  });
});
