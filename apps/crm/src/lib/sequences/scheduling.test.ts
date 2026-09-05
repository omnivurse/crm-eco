import { describe, it, expect } from 'vitest';
import { calculateNextStepTime, normalizeSendDays } from './scheduling';

describe('normalizeSendDays', () => {
  it('accepts the strings the step editor writes', () => {
    // The editor stores String(day), so this is the shape actually in JSONB.
    expect(normalizeSendDays(['1', '3', '5'])).toEqual([1, 3, 5]);
  });

  it('accepts plain numbers', () => {
    expect(normalizeSendDays([0, 6])).toEqual([0, 6]);
  });

  it('sorts and de-duplicates', () => {
    expect(normalizeSendDays(['5', 1, '1', 3])).toEqual([1, 3, 5]);
  });

  it('drops values outside 0-6 and unparseable entries', () => {
    expect(normalizeSendDays(['7', '-1', 'monday', null, undefined, 2])).toEqual([2]);
  });

  it('returns empty for non-arrays', () => {
    expect(normalizeSendDays(null)).toEqual([]);
    expect(normalizeSendDays(undefined)).toEqual([]);
    expect(normalizeSendDays('1,2')).toEqual([]);
  });
});

describe('calculateNextStepTime', () => {
  // Wednesday 2026-09-02T12:00:00Z
  const now = new Date('2026-09-02T12:00:00.000Z');

  it('adds the configured delay', () => {
    const result = calculateNextStepTime({ delayDays: 2, now });
    expect(new Date(result).getTime()).toBe(
      new Date('2026-09-04T12:00:00.000Z').getTime(),
    );
  });

  it('adds hours and minutes', () => {
    const result = calculateNextStepTime({ delayHours: 3, delayMinutes: 30, now });
    expect(new Date(result).getTime()).toBe(
      new Date('2026-09-02T15:30:00.000Z').getTime(),
    );
  });

  it('treats missing delays as immediate', () => {
    const result = calculateNextStepTime({ now });
    expect(new Date(result).getTime()).toBe(now.getTime());
  });

  it('terminates when send days are strings', () => {
    // Regression: the previous implementation compared string days against
    // Date#getDay() (a number), so this call never returned.
    const result = calculateNextStepTime({ sendDays: ['1', '3', '5'], now });
    const day = new Date(result).getDay();
    expect([1, 3, 5]).toContain(day);
  });

  it('terminates even when no send day can be satisfied', () => {
    // Nothing here normalises into 0-6, so the filter is empty and the date
    // is returned untouched rather than looping.
    const result = calculateNextStepTime({ sendDays: ['not-a-day'], now });
    expect(new Date(result).getTime()).toBe(now.getTime());
  });

  it('advances to the next permitted day', () => {
    // now is a Wednesday (3); restricted to Friday (5).
    const result = calculateNextStepTime({ sendDays: [5], now });
    expect(new Date(result).getDay()).toBe(5);
  });

  it('leaves the date alone when it already lands on a permitted day', () => {
    const result = calculateNextStepTime({ sendDays: [3], now });
    expect(new Date(result).getTime()).toBe(now.getTime());
  });

  it('never advances more than a week', () => {
    const result = calculateNextStepTime({ sendDays: [0, 1, 2, 3, 4, 5, 6], now });
    const diff = new Date(result).getTime() - now.getTime();
    expect(diff).toBeLessThan(7 * 24 * 60 * 60 * 1000);
  });

  it('ignores a malformed send time rather than producing an invalid date', () => {
    const result = calculateNextStepTime({ sendTime: 'not-a-time', now });
    expect(Number.isNaN(new Date(result).getTime())).toBe(false);
  });
});
