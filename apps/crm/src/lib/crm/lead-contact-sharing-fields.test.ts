import { describe, expect, it } from 'vitest';
import {
  bridgeIndexedCarrierIdToSharingEntity,
  bridgeLegacyCarrierToSharingEntity,
  mergeHealthSharingIntoContactData,
  pickHealthSharingFieldsFromData,
} from './lead-contact-sharing-fields';
import { mergeCrmDataJsonIntoRowColumns } from './merge-crm-data-json-to-row';

describe('pickHealthSharingFieldsFromData', () => {
  it('extracts populated sharing keys only', () => {
    expect(
      pickHealthSharingFieldsFromData({
        sharing_entity: '11111111-1111-1111-1111-111111111111',
        member_tier: 'EF',
        phone: '555',
      }),
    ).toEqual({
      sharing_entity: '11111111-1111-1111-1111-111111111111',
      member_tier: 'EF',
    });
  });
});

describe('mergeHealthSharingIntoContactData', () => {
  it('fills blank contact fields from lead without overwriting contact values', () => {
    const result = mergeHealthSharingIntoContactData(
      { sharing_entity: '', member_tier: 'Existing' },
      { sharing_entity: 'Sedera', member_tier: 'EF', monthly_contribution: '100' },
    );
    expect(result).toEqual({
      sharing_entity: 'Sedera',
      member_tier: 'Existing',
      monthly_contribution: '100',
    });
  });
});

describe('bridgeLegacyCarrierToSharingEntity', () => {
  it('maps legacy ministry carrier to sharing_entity on contacts', () => {
    const base = { carrier: 'Zion Health' };
    bridgeLegacyCarrierToSharingEntity(base, 'contacts');
    expect(base.sharing_entity).toBe('Zion Health');
  });

  it('routes a known insurance carrier to health_insurance_carrier, not sharing_entity', () => {
    const base: Record<string, unknown> = { carrier: 'Cigna' };
    bridgeLegacyCarrierToSharingEntity(base, 'contacts');
    expect(base.health_insurance_carrier).toBe('Cigna');
    expect(base.sharing_entity).toBeUndefined();
  });

  it('routes spaced United Healthcare to health_insurance_carrier, not sharing_entity', () => {
    const base: Record<string, unknown> = { carrier: 'United Healthcare' };
    bridgeLegacyCarrierToSharingEntity(base, 'contacts');
    expect(base.health_insurance_carrier).toBe('United Healthcare');
    expect(base.sharing_entity).toBeUndefined();
  });

  it('routes an insurance carrier to insurance even when sharing_entity is already set', () => {
    const base: Record<string, unknown> = { carrier: 'Aetna', sharing_entity: 'Sedera' };
    bridgeLegacyCarrierToSharingEntity(base, 'contacts');
    expect(base.health_insurance_carrier).toBe('Aetna');
    expect(base.sharing_entity).toBe('Sedera');
  });

  it('does not overwrite an existing health_insurance_carrier', () => {
    const base: Record<string, unknown> = {
      carrier: 'Cigna',
      health_insurance_carrier: 'Aetna',
    };
    bridgeLegacyCarrierToSharingEntity(base, 'contacts');
    expect(base.health_insurance_carrier).toBe('Aetna');
    expect(base.sharing_entity).toBeUndefined();
  });
});

describe('bridgeIndexedCarrierIdToSharingEntity', () => {
  it('maps row carrier_id to sharing_entity when JSONB is blank', () => {
    const base = {
      carrier_id: '11111111-1111-1111-1111-111111111111',
    };
    bridgeIndexedCarrierIdToSharingEntity(base, 'contacts');
    expect(base.sharing_entity).toBe('11111111-1111-1111-1111-111111111111');
  });
});

describe('mergeCrmDataJsonIntoRowColumns sharing sync', () => {
  it('sets market_type and carrier_id when sharing_entity is a UUID', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      {
        sharing_entity: '11111111-1111-1111-1111-111111111111',
        sharing_effective_date: '2026-07-01',
      },
      { moduleKey: 'contacts' },
    );
    expect(updates.market_type).toBe('healthshare');
    expect(updates.carrier_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(updates.original_start_date).toBe('2026-07-01');
  });
});
