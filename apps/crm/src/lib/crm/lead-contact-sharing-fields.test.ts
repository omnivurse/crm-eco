import { describe, expect, it } from 'vitest';
import {
  bridgeIndexedCarrierIdToSharingEntity,
  bridgeLegacyCarrierToSharingEntity,
  bridgeLegacyHealthSharingReadPaths,
  buildHealthSharingCanonicalBackfillPatch,
  hasHealthSharingMarketSignal,
  mergeHealthSharingIntoContactData,
  pickHealthSharingFieldsFromData,
  shouldProjectHealthSharingLegacyFields,
} from './lead-contact-sharing-fields';
import { mergeCrmDataJsonIntoRowColumns } from './merge-crm-data-json-to-row';
import { mergeCrmRecordRowIntoFormDefaults } from './record-form-defaults';

describe('hasHealthSharingMarketSignal', () => {
  it('is false for date-only payloads', () => {
    expect(hasHealthSharingMarketSignal({ sharing_effective_date: '2026-09-01' })).toBe(
      false,
    );
  });

  it('is true for sharing entity, member tier, or leads membership name', () => {
    expect(hasHealthSharingMarketSignal({ sharing_entity: 'Sedera' })).toBe(true);
    expect(hasHealthSharingMarketSignal({ member_tier: 'Member Only' })).toBe(true);
    expect(hasHealthSharingMarketSignal({ product_type: 'Sedera Select' })).toBe(true);
  });

  it('does not treat product_type as HS when an insurance plan is also set', () => {
    expect(
      hasHealthSharingMarketSignal({
        product_type: 'Gold PPO',
        health_insurance_plan_name: 'Cigna Gold',
      }),
    ).toBe(false);
  });
});

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

  it('does not set healthshare from sharing_effective_date alone', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      { sharing_effective_date: '2026-09-01' },
      { moduleKey: 'leads' },
    );
    expect(updates.market_type).toBeUndefined();
  });

  it('sets traditional_insurance from insurance plan + start without a sharing entity', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      {
        health_insurance_plan_name: 'Cigna Gold',
        health_insurance_start_date: '2026-09-01',
      },
      { moduleKey: 'leads' },
    );
    expect(updates.market_type).toBe('traditional_insurance');
    expect(updates.original_start_date).toBe('2026-09-01');
  });
});

describe('bridgeLegacyHealthSharingReadPaths', () => {
  it('projects David Lung–style Zoho legacy keys onto canonical Health Share fields', () => {
    const base: Record<string, unknown> = {
      market_type: 'healthshare',
      carrier: 'Zion Health',
      e123_member_id: '677910847',
      member_number: '677910847',
      start_date: '2021-06-01',
      monthly_premium: '733',
      iua_amount: '1250',
      contact_status: 'Active HS Member',
    };
    bridgeLegacyHealthSharingReadPaths(base, 'contacts');
    bridgeLegacyCarrierToSharingEntity(base, 'contacts');

    expect(base.sharing_member_id).toBe('677910847');
    expect(base.sharing_effective_date).toBe('2021-06-01');
    expect(base.monthly_contribution).toBe('733');
    expect(base.sharing_status).toBe('Active HS Member');
    expect(base.sharing_entity).toBe('Zion Health');
    expect(base.iua_amount).toBe('1250');
  });

  it('does not invent Health Share fields on traditional insurance rows (Heidi)', () => {
    const base: Record<string, unknown> = {
      market_type: 'traditional_insurance',
      carrier: 'Other',
      start_date: '2025-08-01',
      monthly_premium: '400',
      contact_status: 'Enrolled - 2026',
      product: 'Health Insurance',
      email: 'heidikloser@gmail.com',
      phone: '970-376-8602',
    };
    bridgeLegacyHealthSharingReadPaths(base, 'contacts');
    expect(base.sharing_member_id).toBeUndefined();
    expect(base.sharing_effective_date).toBeUndefined();
    expect(base.monthly_contribution).toBeUndefined();
    expect(base.sharing_status).toBeUndefined();
  });

  it('does not overwrite non-blank canonical keys', () => {
    const base: Record<string, unknown> = {
      market_type: 'healthshare',
      sharing_member_id: 'CANONICAL',
      e123_member_id: 'LEGACY',
      sharing_effective_date: '2020-01-01',
      start_date: '2021-06-01',
      monthly_contribution: '50',
      monthly_premium: '733',
      member_tier: 'Member Only',
      coverage_option: 'Member and Family',
    };
    bridgeLegacyHealthSharingReadPaths(base, 'contacts');
    expect(base.sharing_member_id).toBe('CANONICAL');
    expect(base.sharing_effective_date).toBe('2020-01-01');
    expect(base.monthly_contribution).toBe('50');
    expect(base.member_tier).toBe('Member Only');
  });

  it('fills blank member_tier from leftover Zoho coverage_option on HealthShare', () => {
    const base: Record<string, unknown> = {
      market_type: 'healthshare',
      coverage_option: 'Member + Family',
    };
    bridgeLegacyHealthSharingReadPaths(base, 'contacts');
    expect(base.member_tier).toBe('Member + Family');
  });

  it('does not copy coverage_option onto member_tier for insurance rows', () => {
    const base: Record<string, unknown> = {
      market_type: 'traditional_insurance',
      coverage_option: 'Member + Family',
    };
    bridgeLegacyHealthSharingReadPaths(base, 'contacts');
    expect(base.member_tier).toBeUndefined();
  });

  it('form defaults merge projects David Lung end-to-end', () => {
    const defaults = mergeCrmRecordRowIntoFormDefaults(
      {
        email: 'DaveLung@Da2Ventures.com',
        phone: '970-779-4782',
        status: 'active',
        market_type: 'healthshare',
        data: {
          first_name: 'David',
          last_name: 'Lung',
          carrier: 'Zion Health',
          e123_member_id: '677910847',
          start_date: '2021-06-01',
          monthly_premium: '733',
          iua_amount: '1250',
        },
      },
      { moduleKey: 'contacts' },
    );
    expect(defaults.sharing_entity).toBe('Zion Health');
    expect(defaults.sharing_member_id).toBe('677910847');
    expect(defaults.sharing_effective_date).toBe('2021-06-01');
    expect(defaults.monthly_contribution).toBe('733');
    // Indexed status is "active"; Zoho contact_status is preserved onto sharing_status
    // when present in JSONB before the status overlay.
    expect(defaults.sharing_status).toBeTruthy();
  });

  it('preserves Zoho contact_status onto sharing_status before indexed status overlay', () => {
    const defaults = mergeCrmRecordRowIntoFormDefaults(
      {
        status: 'active',
        market_type: 'healthshare',
        data: {
          contact_status: 'Active HS Member',
          e123_member_id: '677910847',
        },
      },
      { moduleKey: 'contacts' },
    );
    expect(defaults.contact_status).toBe('active');
    expect(defaults.sharing_status).toBe('Active HS Member');
    expect(defaults.sharing_member_id).toBe('677910847');
  });
});

describe('buildHealthSharingCanonicalBackfillPatch', () => {
  it('returns only blank canonical keys recovered from legacy', () => {
    const patch = buildHealthSharingCanonicalBackfillPatch(
      {
        carrier: 'Zion Health',
        e123_member_id: '677910847',
        start_date: '2021-06-01',
        monthly_premium: '733',
        iua_amount: '1250',
        sharing_entity: 'Zion Health',
        coverage_option: 'Member Only',
      },
      { marketType: 'healthshare', moduleKey: 'contacts' },
    );
    expect(patch).toEqual({
      sharing_member_id: '677910847',
      sharing_effective_date: '2021-06-01',
      monthly_contribution: '733',
      member_tier: 'Member Only',
    });
  });

  it('returns null when nothing to backfill', () => {
    expect(
      buildHealthSharingCanonicalBackfillPatch(
        {
          sharing_member_id: '677910847',
          sharing_effective_date: '2021-06-01',
          monthly_contribution: '733',
          sharing_entity: 'Zion Health',
        },
        { marketType: 'healthshare' },
      ),
    ).toBeNull();
  });
});

describe('shouldProjectHealthSharingLegacyFields', () => {
  it('is true for healthshare and false for traditional_insurance', () => {
    expect(shouldProjectHealthSharingLegacyFields({ market_type: 'healthshare' })).toBe(true);
    expect(
      shouldProjectHealthSharingLegacyFields({ market_type: 'traditional_insurance' }),
    ).toBe(false);
  });
});
