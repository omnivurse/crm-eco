import { describe, expect, it } from 'vitest';
import { classifyCarrierValue } from './coverage-carriers';
import { selectHeroSharingField } from './coverage-snapshot-identity';
import {
  coerceCoverageSnapshotFieldValue,
} from './coverage-snapshot-plan-fields';
import { resolveCoverageSnapshotPlanType } from './coverage-snapshot-plan-type';
import { bridgeSharingEntityReadPaths } from './lead-contact-sharing-fields';
import { mergeCrmRecordRowIntoFormDefaults } from './record-form-defaults';

/**
 * Regression: James Benvenuto contact after Phase 2 repair must resolve to
 * Insurance Carrier / United Healthcare on THAT contact row only — never a
 * Sharing Entity banner, and never a capacity-alias Membership.
 */
describe('James Benvenuto contact coverage display', () => {
  const contactRow = {
    id: 'f14bc45b-ba0c-488e-9b7c-a607de4e5649',
    email: 'jwbaspen@me.com',
    status: 'Cancelled',
    market_type: 'traditional_insurance',
    carrier_id: null,
    data: {
      first_name: 'James',
      last_name: 'Benvenuto',
      email: 'jwbaspen@me.com',
      carrier: 'United Healthcare',
      health_insurance_carrier: 'United Healthcare',
      sharing_entity: null,
      monthly_premium: 1070,
      coverage_option: 'Member + Family',
      iua_amount: '1250',
      linked_member_id: '8b7d0548-e15f-4cfa-94f4-8fc1380ab0a3',
      member_number: '681834008',
    },
  };

  it('form defaults for the contact resolve insurance identity (not Sharing Entity)', () => {
    const defaults = mergeCrmRecordRowIntoFormDefaults(contactRow, {
      moduleKey: 'contacts',
    });

    expect(defaults.market_type).toBe('traditional_insurance');
    expect(defaults.health_insurance_carrier).toBe('United Healthcare');
    // Known insurer must not be bridged into sharing_entity
    expect(defaults.sharing_entity).not.toBe('United Healthcare');

    const hero = selectHeroSharingField({
      candidates: [
        { key: 'sharing_entity' },
        { key: 'health_insurance_carrier' },
        { key: 'carrier' },
      ],
      values: defaults,
    });
    expect(hero?.key).toBe('health_insurance_carrier');
    expect(defaults[hero!.key]).toBe('United Healthcare');
    expect(classifyCarrierValue(defaults[hero!.key])).toBe('insurance');

    const hasValue = (key: string) => {
      const v = defaults[key];
      return v !== null && v !== undefined && v !== '';
    };
    const planType = resolveCoverageSnapshotPlanType({
      values: defaults,
      heroCarrierValue: defaults[hero!.key],
      hasValue,
    });
    expect(planType).toBe('insurance');
    // No capacity-alias Membership — blank product displays empty
    const productDisplay = coerceCoverageSnapshotFieldValue('product', defaults.product);
    expect(productDisplay === null || productDisplay === undefined || productDisplay === '').toBe(
      true,
    );
  });

  it('does not invent coverage when opening a sparse CRM members module twin', () => {
    const sparseMember = {
      id: 'dac6d318-bf3a-4be2-92ce-c2d297c28b31',
      email: 'jwbaspen@me.com',
      status: 'active',
      market_type: 'unknown',
      data: {
        first_name: 'James',
        last_name: 'Benvenuto',
        email: 'jwbaspen@me.com',
        member_number: '686119322',
      },
    };
    const defaults = mergeCrmRecordRowIntoFormDefaults(sparseMember, {
      moduleKey: 'members',
    });
    const base = { ...defaults };
    bridgeSharingEntityReadPaths(base, 'members');

    expect(base.carrier).toBeUndefined();
    expect(base.health_insurance_carrier).toBeUndefined();
    expect(base.sharing_entity).toBeUndefined();

    const hero = selectHeroSharingField({
      candidates: [
        { key: 'sharing_entity' },
        { key: 'health_insurance_carrier' },
        { key: 'carrier' },
      ],
      values: base,
    });
    // No carrier candidate wins — empty identity rail, not another person's data
    expect(hero === undefined || !base[hero.key]).toBe(true);
  });
});
