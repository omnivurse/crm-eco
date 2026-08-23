import { describe, expect, it } from 'vitest';
import {
  hasEverCancelled,
  hasOpenCancelledPeriod,
  pairCancellationPeriods,
  shouldAppendCancelled,
  shouldAppendReturned,
} from './person-lifecycle-ledger';

describe('person lifecycle ledger periods', () => {
  it('treats a lone cancelled as an open period', () => {
    const events = [{ event_type: 'cancelled', event_date: '2024-01-01', created_at: '2024-01-01T00:00:00Z' }];
    expect(hasOpenCancelledPeriod(events)).toBe(true);
    expect(shouldAppendCancelled(events)).toBe(false);
    expect(shouldAppendReturned(events)).toBe(true);
  });

  it('closes the period on returned and allows a later cancelled', () => {
    const events = [
      { event_type: 'cancelled', event_date: '2024-01-01', created_at: '2024-01-01T00:00:00Z' },
      { event_type: 'returned', event_date: '2024-06-01', created_at: '2024-06-01T00:00:00Z' },
    ];
    expect(hasOpenCancelledPeriod(events)).toBe(false);
    expect(shouldAppendCancelled(events)).toBe(true);
    expect(shouldAppendReturned(events)).toBe(false);
  });

  it('does not write a second cancelled while one is open', () => {
    const events = [
      { event_type: 'cancelled', event_date: '2023-01-01', created_at: '2023-01-01T00:00:00Z' },
      { event_type: 'returned', event_date: '2023-06-01', created_at: '2023-06-01T00:00:00Z' },
      { event_type: 'cancelled', event_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' },
    ];
    expect(hasOpenCancelledPeriod(events)).toBe(true);
    expect(shouldAppendCancelled(events)).toBe(false);
  });

  it('writes the first cancelled on an empty ledger', () => {
    expect(shouldAppendCancelled([])).toBe(true);
    expect(shouldAppendReturned([])).toBe(false);
    expect(hasEverCancelled([])).toBe(false);
  });

  it('pairs every cancelled period and keeps an open one after reactivate is missing', () => {
    const events = [
      { event_type: 'cancelled', event_date: '2023-01-01', created_at: '2023-01-01T00:00:00Z' },
      { event_type: 'returned', event_date: '2023-06-01', created_at: '2023-06-01T00:00:00Z' },
      { event_type: 'cancelled', event_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' },
    ];
    expect(hasEverCancelled(events)).toBe(true);
    expect(pairCancellationPeriods(events)).toEqual([
      {
        cancelled: events[2],
        returned: null,
      },
      {
        cancelled: events[0],
        returned: events[1],
      },
    ]);
  });
});
