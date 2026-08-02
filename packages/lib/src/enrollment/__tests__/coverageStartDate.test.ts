import { describe, expect, it } from 'vitest';
import {
  assertPendingHasEffectiveDate,
  defaultNextCoverageStartFirst,
  normalizeCoverageStartToFirstOfMonth,
  resolvePendingMemberEffectiveDate,
} from '../coverageStartDate';

describe('normalizeCoverageStartToFirstOfMonth', () => {
  it('normalizes mid-month ISO to the 1st', () => {
    expect(normalizeCoverageStartToFirstOfMonth('2026-08-15')).toBe('2026-08-01');
  });

  it('keeps already-first dates', () => {
    expect(normalizeCoverageStartToFirstOfMonth('2026-08-01')).toBe('2026-08-01');
  });

  it('parses US dates', () => {
    expect(normalizeCoverageStartToFirstOfMonth('8/15/2026')).toBe('2026-08-01');
  });

  it('returns null for empty', () => {
    expect(normalizeCoverageStartToFirstOfMonth(null)).toBeNull();
    expect(normalizeCoverageStartToFirstOfMonth('')).toBeNull();
  });
});

describe('defaultNextCoverageStartFirst', () => {
  it('returns first of next month', () => {
    expect(defaultNextCoverageStartFirst(new Date('2026-07-15T12:00:00Z'))).toBe('2026-08-01');
    expect(defaultNextCoverageStartFirst(new Date('2026-12-01T00:00:00Z'))).toBe('2027-01-01');
  });
});

describe('resolvePendingMemberEffectiveDate', () => {
  it('normalizes provided date', () => {
    expect(resolvePendingMemberEffectiveDate('2026-09-20')).toBe('2026-09-01');
  });

  it('defaults when missing', () => {
    const result = resolvePendingMemberEffectiveDate(null);
    expect(result).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe('assertPendingHasEffectiveDate', () => {
  it('allows non-pending without date when allowDefault', () => {
    expect(assertPendingHasEffectiveDate('active', null).ok).toBe(true);
  });

  it('fails pending without date when allowDefault false', () => {
    const check = assertPendingHasEffectiveDate('pending', null, { allowDefault: false });
    expect(check.ok).toBe(false);
  });

  it('defaults pending when allowDefault true', () => {
    const check = assertPendingHasEffectiveDate('pending', null, { allowDefault: true });
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.effectiveDate).toMatch(/^\d{4}-\d{2}-01$/);
  });
});
