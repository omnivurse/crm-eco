import { describe, expect, it } from 'vitest';
import { decideMembershipAdd, membershipLayerOf, parseShopTerms } from '../layers';
import { packagePurchaseAmounts, planPackageRedeem } from '../packages';
import { buildShopCatalog, normalizeCartItems } from '../shop';
import {
  shopAchAllowsItem,
  shopAchCartGuard,
  shopCardGatewayGuard,
  shopChargeIdempotencyKey,
  shopPaymentUsesNachaQueue,
  shopPeriodAmountCents,
  shouldProvisionAfterShopCharge,
} from '../shopCharge';

describe('parseShopTerms', () => {
  it('defaults existing plans to non-purchasable core', () => {
    expect(parseShopTerms(null)).toEqual({ kind: 'core', purchasable: false, frequency: 'monthly' });
  });

  it('reads addon shop flags', () => {
    expect(parseShopTerms({ shop: { kind: 'addon', purchasable: true, frequency: 'quarterly' } })).toEqual({
      kind: 'addon',
      purchasable: true,
      frequency: 'quarterly',
    });
  });
});

describe('decideMembershipAdd', () => {
  const core = { id: 'm1', status: 'active', plan_id: 'core-1', sponsor_id: null, layer: 'core' };

  it('blocks a second core plan', () => {
    const d = decideMembershipAdd({
      existing: [core],
      next: { plan_id: 'core-2', layer: 'core', sponsored: false },
    });
    expect(d.ok).toBe(false);
  });

  it('allows an addon on top of a core plan', () => {
    const d = decideMembershipAdd({
      existing: [core],
      next: { plan_id: 'addon-1', layer: 'addon', sponsored: false },
    });
    expect(d).toEqual({ ok: true });
  });

  it('blocks the same plan twice', () => {
    const d = decideMembershipAdd({
      existing: [core],
      next: { plan_id: 'core-1', layer: 'addon', sponsored: false },
    });
    expect(d.ok).toBe(false);
  });

  it('blocks a second sponsored membership', () => {
    const d = decideMembershipAdd({
      existing: [{ ...core, sponsor_id: 'sp-1' }],
      next: { plan_id: 'core-2', layer: 'core', sponsored: true },
    });
    expect(d.ok).toBe(false);
  });

  it('blocks an addon when the member has no household membership', () => {
    const d = decideMembershipAdd({
      existing: [],
      next: { plan_id: 'addon-1', layer: 'addon', sponsored: false },
    });
    expect(d.ok).toBe(false);
  });
});

describe('membershipLayerOf', () => {
  it('prefers the column then custom_fields', () => {
    expect(membershipLayerOf({ layer: 'addon', custom_fields: { layer: 'core' } })).toBe('addon');
    expect(membershipLayerOf({ custom_fields: { layer: 'addon' } })).toBe('addon');
    expect(membershipLayerOf({})).toBe('core');
  });
});

describe('packages', () => {
  it('redeems units and recognizes deferred revenue', () => {
    const plan = planPackageRedeem({
      unitsRemaining: 4,
      redeemUnits: 1,
      deferredRemaining: 400,
      unitsPurchased: 4,
    });
    expect(plan).toMatchObject({ remaining: 3, status: 'active', deferred_remaining: 300 });
  });

  it('exhausts on the last unit', () => {
    const plan = planPackageRedeem({
      unitsRemaining: 1,
      redeemUnits: 1,
      deferredRemaining: 50,
      unitsPurchased: 2,
    });
    expect(plan).toMatchObject({ remaining: 0, status: 'exhausted' });
  });

  it('rejects over-redemption', () => {
    const plan = planPackageRedeem({
      unitsRemaining: 1,
      redeemUnits: 2,
      deferredRemaining: 10,
      unitsPurchased: 1,
    });
    expect(plan).toMatchObject({ ok: false });
  });

  it('computes package tax', () => {
    expect(packagePurchaseAmounts({ price: 100, taxRate: 0.07, quantity: 2 })).toEqual({
      subtotal: 200,
      tax_amount: 14,
      total: 214,
    });
  });
});

describe('shop catalog', () => {
  it('only lists purchasable addon plans the member does not already hold', () => {
    const catalog = buildShopCatalog({
      plans: [
        {
          id: 'core-1',
          name: 'Share',
          code: 'SHARE',
          monthly_share: 199,
          description: null,
          is_active: true,
          metadata: {},
        },
        {
          id: 'addon-1',
          name: 'Weight',
          code: 'WL',
          monthly_share: 49,
          description: 'Add-on',
          is_active: true,
          metadata: { shop: { kind: 'addon', purchasable: true } },
        },
        {
          id: 'addon-held',
          name: 'Held',
          code: 'HELD',
          monthly_share: 20,
          description: null,
          is_active: true,
          metadata: { shop: { kind: 'addon', purchasable: true } },
        },
      ],
      packages: [
        {
          id: 'pkg-1',
          name: '4 visits',
          sku: 'VIS-4',
          description: null,
          price: 200,
          tax_rate: 0,
          units: 4,
          unit_label: 'visits',
          entitlement_kind: 'visits',
          is_active: true,
        },
      ],
      existing: [{ status: 'active', plan_id: 'core-1', layer: 'core' }, { status: 'active', plan_id: 'addon-held', layer: 'addon' }],
    });
    expect(catalog.plans.map((p) => p.id)).toEqual(['addon-1']);
    expect(catalog.packages.map((p) => p.id)).toEqual(['pkg-1']);
  });

  it('dedupes cart lines', () => {
    expect(
      normalizeCartItems([
        { item_type: 'plan', plan_id: 'a', quantity: 2 },
        { item_type: 'plan', plan_id: 'a', quantity: 1 },
        { item_type: 'package', package_id: 'p', quantity: 3 },
      ]),
    ).toEqual([
      { item_type: 'plan', plan_id: 'a', quantity: 1 },
      { item_type: 'package', package_id: 'p', quantity: 3 },
    ]);
  });
});

describe('shop charge-then-provision', () => {
  it('builds a stable idempotency key', () => {
    expect(
      shopChargeIdempotencyKey({
        memberId: 'm1',
        itemType: 'plan',
        itemId: 'p1',
        period: '2026-09',
      }),
    ).toBe('shop_plan_m1_p1_2026-09');
  });

  it('charges the period amount, not only one month', () => {
    expect(shopPeriodAmountCents(40, 'quarterly')).toBe(12000);
    expect(shopPeriodAmountCents(40, 'monthly')).toBe(4000);
  });

  it('does not provision after a declined charge', () => {
    expect(shouldProvisionAfterShopCharge({ success: false })).toBe(false);
    expect(shouldProvisionAfterShopCharge({ success: true })).toBe(true);
  });

  it('queues bank accounts for NACHA and refuses placeholder card charges', () => {
    expect(shopPaymentUsesNachaQueue('bank_account')).toBe(true);
    expect(shopPaymentUsesNachaQueue('credit_card')).toBe(false);
    expect(
      shopCardGatewayGuard({
        paymentType: 'bank_account',
        processor: 'placeholder',
        gatewayCustomerId: 'nacha-local-1',
        gatewayPaymentProfileId: 'nacha-local-1',
      }).ok,
    ).toBe(false);
    expect(
      shopCardGatewayGuard({
        paymentType: 'credit_card',
        processor: 'placeholder',
        gatewayCustomerId: 'cust',
        gatewayPaymentProfileId: 'prof',
      }),
    ).toEqual({
      ok: false,
      error: 'Card checkout requires a live card processor. Placeholder charges are refused.',
    });
    expect(
      shopCardGatewayGuard({
        paymentType: 'credit_card',
        processor: 'nmi',
        gatewayCustomerId: 'cust',
        gatewayPaymentProfileId: 'prof',
      }).ok,
    ).toBe(true);
    expect(shopAchAllowsItem('plan')).toBe(true);
    expect(shopAchAllowsItem('package')).toBe(false);
    expect(shopAchCartGuard({ paymentType: 'bank_account', itemTypes: ['plan'] }).ok).toBe(true);
    expect(shopAchCartGuard({ paymentType: 'bank_account', itemTypes: ['package'] })).toEqual({
      ok: false,
      error:
        'Prepaid packages require a card. ACH can only buy add-on memberships until the bank file settles.',
    });
    expect(shopAchCartGuard({ paymentType: 'credit_card', itemTypes: ['package'] }).ok).toBe(true);
  });
});
