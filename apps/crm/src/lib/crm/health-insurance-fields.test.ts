import { describe, expect, it } from 'vitest';
import {
  bridgeIndexedCarrierIdToHealthInsuranceCarrier,
  leadHasHealthInsuranceData,
} from './health-insurance-fields';
import { mergeCrmDataJsonIntoRowColumns } from './merge-crm-data-json-to-row';
import { bridgeHealthInsuranceReadPaths } from './health-insurance-fields';

describe('health-insurance-fields', () => {
  it('detects populated health insurance JSONB', () => {
    expect(
      leadHasHealthInsuranceData({
        health_insurance_plan_name: 'Gold PPO',
      }),
    ).toBe(true);
  });

  it('bridges indexed carrier_id to health_insurance_carrier on read', () => {
    const base = {
      market_type: 'health_insurance',
      carrier_id: '11111111-1111-1111-1111-111111111111',
    };
    bridgeHealthInsuranceReadPaths(base, 'leads');
    expect(base.health_insurance_carrier).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('does not bridge when market_type is healthshare', () => {
    const base = {
      market_type: 'healthshare',
      carrier_id: '11111111-1111-1111-1111-111111111111',
    };
    bridgeIndexedCarrierIdToHealthInsuranceCarrier(base, 'contacts');
    expect(base.health_insurance_carrier).toBeUndefined();
  });
});

describe('mergeCrmDataJsonIntoRowColumns health insurance sync', () => {
  it('sets market_type and carrier_id when health_insurance_carrier is a UUID', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      {
        health_insurance_carrier: '22222222-2222-2222-2222-222222222222',
        health_insurance_start_date: '2026-08-01',
      },
      { moduleKey: 'leads' },
    );
    expect(updates.market_type).toBe('health_insurance');
    expect(updates.carrier_id).toBe('22222222-2222-2222-2222-222222222222');
    expect(updates.original_start_date).toBe('2026-08-01');
  });
});
