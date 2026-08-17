import { describe, expect, it } from 'vitest';
import {
  isCarrierIdentityField,
  resolveInlineCarrierType,
} from './carrier-field';

describe('isCarrierIdentityField', () => {
  it('treats indexed carrier_id as a carrier even when typed as lookup', () => {
    expect(isCarrierIdentityField({ key: 'carrier_id', metadata: {} })).toBe(true);
  });

  it('treats metadata.carrier_type as carrier', () => {
    expect(
      isCarrierIdentityField({
        key: 'sharing_entity',
        metadata: { carrier_type: 'healthshare' },
      }),
    ).toBe(true);
  });

  it('does not treat person lookups as carriers', () => {
    expect(isCarrierIdentityField({ key: 'referred_by', metadata: {} })).toBe(false);
  });
});

describe('resolveInlineCarrierType', () => {
  it('prefers declared metadata', () => {
    expect(
      resolveInlineCarrierType(
        { key: 'carrier_id', metadata: { carrier_type: 'insurance' } },
        { market_type: 'healthshare' },
      ),
    ).toBe('insurance');
  });

  it('uses market_type for carrier_id (Sedera HealthShare case)', () => {
    expect(
      resolveInlineCarrierType(
        { key: 'carrier_id', metadata: {} },
        { market_type: 'healthshare', sharing_entity: 'b9c60010-7541-4e66-b3ba-1d3eb5a84781' },
      ),
    ).toBe('healthshare');
  });

  it('falls back to healthshare when sharing_entity is set', () => {
    expect(
      resolveInlineCarrierType(
        { key: 'carrier_id', metadata: {} },
        { sharing_entity: 'Sedera' },
      ),
    ).toBe('healthshare');
  });

  it('maps traditional_insurance market_type to the insurance picker', () => {
    expect(
      resolveInlineCarrierType(
        { key: 'carrier_id', metadata: {} },
        { market_type: 'traditional_insurance' },
      ),
    ).toBe('insurance');
  });

  it('defaults carrier_id to healthshare when siblings are empty', () => {
    expect(resolveInlineCarrierType({ key: 'carrier_id', metadata: {} })).toBe(
      'healthshare',
    );
  });
});
