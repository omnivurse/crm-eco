import { describe, expect, it } from 'vitest';
import {
  resolveActiveStatusForMarket,
  resolveEffectiveStartDate,
} from './resolve-effective-start-date';

describe('resolveEffectiveStartDate', () => {
  it('prefers indexed current_year_start_date over JSONB start_date', () => {
    expect(
      resolveEffectiveStartDate({
        current_year_start_date: '2026-07-01',
        data: { start_date: '2026-08-01' },
      }),
    ).toBe('2026-07-01');
  });

  it('falls back to legacy JSONB start_date when columns are empty', () => {
    expect(
      resolveEffectiveStartDate({
        data: { start_date: '7/1/2026' },
      }),
    ).toBe('2026-07-01');
  });

  it('reads sharing_effective_date from JSONB', () => {
    expect(
      resolveEffectiveStartDate({
        data: { sharing_effective_date: '2026-07-01' },
      }),
    ).toBe('2026-07-01');
  });
});

describe('resolveActiveStatusForMarket', () => {
  // Activation resolves to ONE canonical lifecycle value regardless of market.
  // Encoding the market in the status produced "Active HS Member" /
  // "Active Insurance Client" — variants that meant exactly "Active" but broke
  // every filter, badge and count comparing against it. The market itself is
  // already recorded in `market_type`.
  it('maps every market to the one canonical Active', () => {
    expect(resolveActiveStatusForMarket('healthshare')).toBe('Active');
    expect(resolveActiveStatusForMarket('traditional_insurance')).toBe('Active');
    expect(resolveActiveStatusForMarket(null)).toBe('Active');
    expect(resolveActiveStatusForMarket('unknown')).toBe('Active');
  });

  it('does not resurrect a legacy variant from the previous status', () => {
    for (const old of [
      'Pending HS Member',
      'Pending Insurance Client',
      'Pending Member',
      'Active HS Member',
    ]) {
      expect(resolveActiveStatusForMarket(null, old)).toBe('Active');
      expect(resolveActiveStatusForMarket('healthshare', old)).toBe('Active');
    }
  });

  it('never returns a value the status picker would refuse to offer', () => {
    const produced = [
      resolveActiveStatusForMarket('healthshare'),
      resolveActiveStatusForMarket('traditional_insurance'),
      resolveActiveStatusForMarket(null, 'Pending HS Member'),
    ];
    for (const v of produced) expect(v).toBe('Active');
  });
});
