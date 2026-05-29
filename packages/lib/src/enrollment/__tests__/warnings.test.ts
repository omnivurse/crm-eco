/**
 * Characterization tests for enrollment warning helpers (pure logic).
 *
 * These lock CURRENT behavior so the upcoming hardening pass (server-side
 * validation/eligibility — see enrollment-hardening-backlog) can refactor
 * with confidence. They assert what the code does today, not what it
 * "should" do.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isMandateState,
  calculateAge,
  isAge65OrOlder,
  computeEnrollmentWarnings,
  getWarningMessages,
} from '../warnings';

describe('isMandateState', () => {
  it('returns true for each mandate state', () => {
    for (const s of ['MA', 'NJ', 'DC', 'CA', 'RI', 'VT']) {
      expect(isMandateState(s)).toBe(true);
    }
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(isMandateState(' ca ')).toBe(true);
    expect(isMandateState('Nj')).toBe(true);
  });

  it('returns false for non-mandate states and empty/nullish input', () => {
    expect(isMandateState('TX')).toBe(false);
    expect(isMandateState('')).toBe(false);
    expect(isMandateState(null)).toBe(false);
    expect(isMandateState(undefined)).toBe(false);
  });
});

describe('calculateAge', () => {
  // Pin "today" so age math is deterministic across environments.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 29, 12, 0, 0)); // 2026-05-29 local noon
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes age when birthday already passed this year', () => {
    expect(calculateAge('1990-01-15')).toBe(36);
  });

  it('decrements when birthday has not occurred yet this year', () => {
    expect(calculateAge('1990-08-01')).toBe(35);
  });

  it('does not decrement on a same-month earlier day', () => {
    expect(calculateAge('1990-05-10')).toBe(36);
  });

  it('returns null for nullish or unparseable input', () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge(undefined)).toBeNull();
    expect(calculateAge('not-a-date')).toBeNull();
  });
});

describe('isAge65OrOlder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 29, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is true at exactly 65', () => {
    expect(isAge65OrOlder('1961-03-10')).toBe(true);
  });

  it('is false below 65', () => {
    expect(isAge65OrOlder('1962-08-01')).toBe(false);
  });

  it('is false for nullish input', () => {
    expect(isAge65OrOlder(null)).toBe(false);
  });
});

describe('computeEnrollmentWarnings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 29, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags both mandate and age65 warnings', () => {
    expect(computeEnrollmentWarnings('CA', '1961-03-10')).toEqual({
      has_mandate_warning: true,
      has_age65_warning: true,
    });
  });

  it('flags neither for a young member in a non-mandate state', () => {
    expect(computeEnrollmentWarnings('TX', '1990-01-15')).toEqual({
      has_mandate_warning: false,
      has_age65_warning: false,
    });
  });
});

describe('getWarningMessages', () => {
  it('returns a message per active warning', () => {
    expect(
      getWarningMessages({ has_mandate_warning: true, has_age65_warning: true })
    ).toHaveLength(2);
    expect(
      getWarningMessages({ has_mandate_warning: false, has_age65_warning: false })
    ).toHaveLength(0);
  });

  it('mandate message mentions the mandate; age message mentions Medicare', () => {
    const [mandateMsg] = getWarningMessages({
      has_mandate_warning: true,
      has_age65_warning: false,
    });
    expect(mandateMsg).toMatch(/mandate/i);

    const [ageMsg] = getWarningMessages({
      has_mandate_warning: false,
      has_age65_warning: true,
    });
    expect(ageMsg).toMatch(/medicare/i);
  });
});
