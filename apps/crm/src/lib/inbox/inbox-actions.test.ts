import { describe, expect, it } from 'vitest';
import {
  SNOOZE_PRESETS,
  belongsInIncoming,
  captureStatuses,
  groupByStatus,
  isSnoozeExpired,
  toggleFlagTags,
} from './inbox-actions';

const preset = (key: string) => SNOOZE_PRESETS.find((p) => p.key === key)!;

describe('snooze presets', () => {
  it('never wakes a thread in the past', () => {
    const times = ['2026-09-04T06:00:00', '2026-09-04T15:59:00', '2026-09-04T23:30:00'];
    for (const time of times) {
      const now = new Date(time);
      for (const p of SNOOZE_PRESETS) {
        expect(p.resolve(now).getTime()).toBeGreaterThan(now.getTime());
      }
    }
  });

  it('means 4pm today when the afternoon is still ahead', () => {
    const now = new Date('2026-09-04T09:00:00');
    const wake = preset('later_today').resolve(now);
    expect(wake.getDate()).toBe(4);
    expect(wake.getHours()).toBe(16);
  });

  it('rolls "later today" to tomorrow morning once the day is over', () => {
    const now = new Date('2026-09-04T18:00:00');
    const wake = preset('later_today').resolve(now);
    expect(wake.getDate()).toBe(5);
    expect(wake.getHours()).toBe(8);
  });

  it('lands next week on a Monday, not on today', () => {
    // 2026-09-07 is a Monday.
    const monday = new Date('2026-09-07T10:00:00');
    const wake = preset('next_week').resolve(monday);
    expect(wake.getDay()).toBe(1);
    expect(wake.getDate()).toBe(14);
  });

  it('lands the weekend on a Saturday', () => {
    const wake = preset('this_weekend').resolve(new Date('2026-09-04T10:00:00'));
    expect(wake.getDay()).toBe(6);
  });
});

describe('toggleFlagTags', () => {
  it('keeps the thread\u2019s other tags', () => {
    expect(toggleFlagTags(['vip', 'starred'], true)).toEqual(['vip']);
    expect(toggleFlagTags(['vip'], false)).toEqual(['vip', 'starred']);
  });

  it('is idempotent in both directions', () => {
    expect(toggleFlagTags(['starred'], false)).toEqual(['starred']);
    expect(toggleFlagTags(['vip'], true)).toEqual(['vip']);
  });

  it('handles a thread that has never been tagged', () => {
    expect(toggleFlagTags(null, false)).toEqual(['starred']);
    expect(toggleFlagTags(undefined, true)).toEqual([]);
  });
});

describe('snooze expiry', () => {
  const now = new Date('2026-09-04T12:00:00Z');

  it('wakes a thread whose time has come', () => {
    expect(isSnoozeExpired({ status: 'snoozed', snoozed_until: '2026-09-04T11:00:00Z' }, now)).toBe(true);
    expect(isSnoozeExpired({ status: 'snoozed', snoozed_until: '2026-09-05T11:00:00Z' }, now)).toBe(false);
  });

  it('does not touch threads that are not snoozed', () => {
    expect(isSnoozeExpired({ status: 'open', snoozed_until: '2020-01-01T00:00:00Z' }, now)).toBe(false);
  });

  it('fails open — a snoozed thread with no wake time is not lost forever', () => {
    expect(isSnoozeExpired({ status: 'snoozed', snoozed_until: null }, now)).toBe(true);
    expect(isSnoozeExpired({ status: 'snoozed', snoozed_until: 'not a date' }, now)).toBe(true);
  });

  it('puts a woken thread back in Incoming', () => {
    expect(belongsInIncoming({ status: 'open' }, now)).toBe(true);
    expect(belongsInIncoming({ status: 'pending' }, now)).toBe(true);
    expect(belongsInIncoming({ status: 'snoozed', snoozed_until: '2026-09-04T11:00:00Z' }, now)).toBe(true);
    expect(belongsInIncoming({ status: 'snoozed', snoozed_until: '2026-09-09T11:00:00Z' }, now)).toBe(false);
    expect(belongsInIncoming({ status: 'archived' }, now)).toBe(false);
  });
});

describe('undo snapshots', () => {
  const rows = [
    { id: 'a', status: 'open' },
    { id: 'b', status: 'pending' },
    { id: 'c', status: 'open' },
    { id: 'd', status: 'archived' },
  ];

  it('remembers each row\u2019s own prior status, not one blanket value', () => {
    const snapshot = captureStatuses(rows, ['a', 'b', 'c']);
    expect(snapshot).toEqual([
      { id: 'a', status: 'open' },
      { id: 'b', status: 'pending' },
      { id: 'c', status: 'open' },
    ]);
  });

  it('ignores ids that are not on screen', () => {
    expect(captureStatuses(rows, ['a', 'zz'])).toEqual([{ id: 'a', status: 'open' }]);
  });

  it('restores in one update per distinct status', () => {
    const groups = groupByStatus(captureStatuses(rows, ['a', 'b', 'c']));
    expect(groups).toEqual([
      { status: 'open', ids: ['a', 'c'] },
      { status: 'pending', ids: ['b'] },
    ]);
  });
});
