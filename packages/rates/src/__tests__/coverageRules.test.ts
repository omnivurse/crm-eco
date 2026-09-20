import { describe, expect, it } from 'vitest';
import {
  applyCoverageToCharge,
  applyCoverageToCharges,
  parseCoverageConfig,
  sponsorInvoiceAmount,
} from '../coverageRules';

const sponsorCore = parseCoverageConfig({
  rules: [{ charge_item_code: 'core_membership', treatment: 'pass_through', who_pays: 'sponsor' }],
});

describe('parseCoverageConfig', () => {
  it('reads nested coverage or a flat object', () => {
    expect(
      parseCoverageConfig({
        coverage: {
          items: [{ code: 'lab', name: 'Lab panel', category: 'lab', list_amount: 80 }],
          rules: [{ charge_item_code: 'lab', treatment: 'included_under', who_pays: 'member', threshold_amount: 50 }],
        },
      })?.items[0].code
    ).toBe('lab');
    expect(parseCoverageConfig({})).toBeUndefined();
  });

  it('coerces numeric strings from the admin form', () => {
    const config = parseCoverageConfig({
      items: [{ code: 'lab', name: 'Lab', category: 'lab', list_amount: '80' }],
      rules: [{ charge_item_code: 'lab', treatment: 'percent_discount', who_pays: 'member', percent: '20' }],
    });
    expect(config?.items[0].list_amount).toBe(80);
    expect(config?.rules[0].percent).toBe(20);
  });
});

describe('applyCoverageToCharge', () => {
  it('defaults an unmatched charge to the member', () => {
    const line = applyCoverageToCharge({ code: 'core_membership', listAmount: 49 });
    expect(line.memberPays).toBe(49);
    expect(line.sponsorPays).toBe(0);
  });

  it('sends a pass-through core share to the sponsor', () => {
    const line = applyCoverageToCharge({ code: 'core_membership', listAmount: 49 }, sponsorCore);
    expect(line.sponsorPays).toBe(49);
    expect(line.memberPays).toBe(0);
  });

  it('includes charges at or under the threshold', () => {
    const config = parseCoverageConfig({
      rules: [{ charge_item_code: 'lab', treatment: 'included_under', who_pays: 'member', threshold_amount: 50 }],
    });
    expect(applyCoverageToCharge({ code: 'lab', listAmount: 40 }, config).planAbsorbed).toBe(40);
    expect(applyCoverageToCharge({ code: 'lab', listAmount: 80 }, config).memberPays).toBe(80);
  });

  it('bills extra quantity to the member after the limit', () => {
    const config = parseCoverageConfig({
      rules: [{ charge_item_code: 'visit', treatment: 'quantity_limit', who_pays: 'sponsor', quantity_limit: 2 }],
    });
    const line = applyCoverageToCharge({ code: 'visit', listAmount: 25, quantity: 3 }, config);
    expect(line.sponsorPays).toBe(50);
    expect(line.memberPays).toBe(25);
  });

  it('applies percent and flat discounts before who-pays', () => {
    const percent = parseCoverageConfig({
      rules: [{ charge_item_code: 'addon', treatment: 'percent_discount', who_pays: 'member', percent: 20 }],
    });
    expect(applyCoverageToCharge({ code: 'addon', listAmount: 100 }, percent).memberPays).toBe(80);
    const flat = parseCoverageConfig({
      rules: [{ charge_item_code: 'addon', treatment: 'flat_amount', who_pays: 'sponsor', flat_amount: 15 }],
    });
    expect(applyCoverageToCharge({ code: 'addon', listAmount: 40 }, flat).sponsorPays).toBe(25);
  });
});

describe('sponsorInvoiceAmount', () => {
  it('keeps the full amount when no rule exists so current invoices do not go to zero', () => {
    expect(sponsorInvoiceAmount(49, undefined)).toBe(49);
  });

  it('uses sponsor share when a rule exists', () => {
    expect(sponsorInvoiceAmount(49, sponsorCore)).toBe(49);
    const memberPaid = parseCoverageConfig({
      rules: [{ charge_item_code: 'core_membership', treatment: 'pass_through', who_pays: 'member' }],
    });
    expect(sponsorInvoiceAmount(49, memberPaid)).toBe(0);
  });
});

describe('applyCoverageToCharges', () => {
  it('sums member and sponsor lines', () => {
    const result = applyCoverageToCharges(
      [
        { code: 'core_membership', listAmount: 49 },
        { code: 'lab', listAmount: 80 },
      ],
      parseCoverageConfig({
        rules: [
          { charge_item_code: 'core_membership', treatment: 'pass_through', who_pays: 'sponsor' },
          { charge_item_code: 'lab', treatment: 'included', who_pays: 'member' },
        ],
      })
    );
    expect(result.sponsorTotal).toBe(49);
    expect(result.memberTotal).toBe(0);
    expect(result.planAbsorbed).toBe(80);
  });
});
