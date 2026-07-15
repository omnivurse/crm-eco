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
  it('maps healthshare to Active HS Member', () => {
    expect(resolveActiveStatusForMarket('healthshare')).toBe('Active HS Member');
  });

  it('defaults to Active when market_type is unset', () => {
    expect(resolveActiveStatusForMarket(null)).toBe('Active');
  });

  it('keeps HS taxonomy from the old status when market_type is null', () => {
    expect(resolveActiveStatusForMarket(null, 'Pending HS Member')).toBe('Active HS Member');
  });

  it('maps traditional_insurance to Active Insurance Client', () => {
    expect(resolveActiveStatusForMarket('traditional_insurance')).toBe('Active Insurance Client');
  });

  it('market_type wins over old status', () => {
    expect(resolveActiveStatusForMarket('traditional_insurance', 'Pending HS Member')).toBe(
      'Active Insurance Client',
    );
  });

  it('plain pending member without market_type stays in Member taxonomy', () => {
    expect(resolveActiveStatusForMarket(null, 'Pending Member')).toBe('Active Member');
  });

  it('keeps Insurance Client taxonomy from the old status when market_type is null', () => {
    expect(resolveActiveStatusForMarket(null, 'Pending Insurance Client')).toBe(
      'Active Insurance Client',
    );
  });
});
