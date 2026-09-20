import type { SupabaseClient } from '@supabase/supabase-js';
import { AchVaultError, loadAchVaultPresence } from '../billing/ach-vault';
import { applyInvoicePayment, generateMemberInvoice } from '../billing/invoice-service';
import { getPaymentProviderForProcessor } from '../billing/charge-resolver';
import { decideMembershipAdd, parseShopTerms, withMembershipLayer } from './layers';
import { packagePurchaseAmounts } from './packages';
import { normalizeCartItems } from './shop';
import {
  shopAchCartGuard,
  shopCardGatewayGuard,
  shopChargeIdempotencyKey,
  shopChargePeriod,
  shopPaymentUsesNachaQueue,
  shopPeriodAmountCents,
  shouldProvisionAfterShopCharge,
} from './shopCharge';
import type { MembershipLayerRow, ShopCartItemInput } from './types';

export type ShopChargeResult = {
  success: boolean;
  transactionId?: string;
  error?: string;
  queued?: boolean;
  enrollmentId?: string | null;
};

export type ShopCharger = (input: {
  organizationId: string;
  memberId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
}) => Promise<ShopChargeResult>;

type ShopPaymentProfile = {
  id: string;
  authorize_customer_profile_id: string | null;
  authorize_payment_profile_id: string | null;
  processor?: string | null;
  payment_type?: string | null;
};

type AnyClient = SupabaseClient;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isMissingRelation(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message ?? '';
  return error?.code === '42P01' || message.includes('does not exist');
}

function isMissingColumn(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message ?? '';
  return error?.code === '42703' || (message.includes('column') && message.includes('does not exist'));
}

async function loadOpenMemberships(
  supabase: AnyClient,
  organizationId: string,
  memberId: string,
): Promise<MembershipLayerRow[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, status, plan_id, sponsor_id, custom_fields')
    .eq('organization_id', organizationId)
    .eq('member_id', memberId)
    .in('status', ['active', 'pending']);
  if (error) throw new Error(error.message);
  return (data ?? []) as MembershipLayerRow[];
}

async function insertMembership(
  supabase: AnyClient,
  row: Record<string, unknown>,
): Promise<{ id: string }> {
  const first = await supabase.from('memberships').insert(row).select('id').single();
  if (!first.error && first.data?.id) return { id: first.data.id as string };
  if (isMissingColumn(first.error) && 'layer' in row) {
    const withoutLayer = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'layer'));
    const retry = await supabase.from('memberships').insert(withoutLayer).select('id').single();
    if (!retry.error && retry.data?.id) return { id: retry.data.id as string };
    throw new Error(retry.error?.message ?? first.error?.message ?? 'Could not create membership');
  }
  throw new Error(first.error?.message ?? 'Could not create membership');
}

async function defaultPaymentProfile(
  supabase: AnyClient,
  organizationId: string,
  memberId: string,
): Promise<ShopPaymentProfile | null> {
  const { data } = await supabase
    .from('payment_profiles')
    .select('id, authorize_customer_profile_id, authorize_payment_profile_id, processor, payment_type')
    .eq('organization_id', organizationId)
    .eq('member_id', memberId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ShopPaymentProfile | null) ?? null;
}

async function queueShopAchCharge(input: {
  supabase: AnyClient;
  organizationId: string;
  memberId: string;
  paymentProfileId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
}): Promise<ShopChargeResult> {
  try {
    const present = await loadAchVaultPresence(input.supabase, input.organizationId, [
      input.paymentProfileId,
    ]);
    if (!present.has(input.paymentProfileId)) {
      return {
        success: false,
        error: 'ACH vault is empty for this payment method. Collect the bank account again before shop checkout.',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof AchVaultError ? error.message : 'ACH vault could not be read.',
    };
  }

  const { data: existing } = await input.supabase
    .from('billing_transactions')
    .select('id, status, enrollment_id')
    .eq('organization_id', input.organizationId)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();
  if (existing?.id) {
    const status = String(existing.status || '');
    if (status === 'failed' || status === 'voided') {
      return {
        success: false,
        error: 'This shop ACH charge already failed. Do not invent a second debit.',
      };
    }
    return {
      success: true,
      queued: true,
      transactionId: existing.id as string,
      enrollmentId: (existing.enrollment_id as string | null) ?? null,
    };
  }

  const { data: queued, error: queueError } = await input.supabase
    .from('billing_transactions')
    .insert({
      organization_id: input.organizationId,
      member_id: input.memberId,
      payment_profile_id: input.paymentProfileId,
      transaction_type: 'charge',
      amount: input.amountCents / 100,
      processing_fee: 0,
      status: 'pending',
      description: `${input.description} — queued for NACHA`,
      idempotency_key: input.idempotencyKey,
    })
    .select('id')
    .single();

  if (queueError?.code === '23505') {
    const { data: raced } = await input.supabase
      .from('billing_transactions')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();
    if (raced?.id) return { success: true, queued: true, transactionId: raced.id as string };
  }

  if (queueError || !queued) {
    return { success: false, error: queueError?.message || 'Failed to queue ACH for NACHA' };
  }
  return { success: true, queued: true, transactionId: queued.id as string };
}

async function attachQueuedShopCharge(
  supabase: AnyClient,
  input: {
    organizationId: string;
    transactionId?: string;
    enrollmentId: string;
  },
) {
  if (!input.transactionId || input.transactionId.startsWith('ZERO-')) return;
  const { data: schedule } = await supabase
    .from('billing_schedules')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('enrollment_id', input.enrollmentId)
    .maybeSingle();
  await supabase
    .from('billing_transactions')
    .update({
      enrollment_id: input.enrollmentId,
      billing_schedule_id: schedule?.id ?? null,
    })
    .eq('id', input.transactionId)
    .eq('organization_id', input.organizationId)
    .eq('status', 'pending');
}

async function defaultChargeShopItem(input: {
  supabase: AnyClient;
  organizationId: string;
  memberId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
  profile: ShopPaymentProfile | null;
}): Promise<ShopChargeResult> {
  if (input.amountCents <= 0) {
    return { success: true, transactionId: `ZERO-${input.idempotencyKey}` };
  }
  if (!input.profile) {
    return { success: false, error: 'Add a payment method before buying from the shop.' };
  }
  if (shopPaymentUsesNachaQueue(input.profile.payment_type)) {
    return queueShopAchCharge({
      supabase: input.supabase,
      organizationId: input.organizationId,
      memberId: input.memberId,
      paymentProfileId: input.profile.id,
      amountCents: input.amountCents,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
    });
  }
  const gate = shopCardGatewayGuard({
    paymentType: input.profile.payment_type,
    processor: input.profile.processor,
    gatewayCustomerId: input.profile.authorize_customer_profile_id,
    gatewayPaymentProfileId: input.profile.authorize_payment_profile_id,
  });
  if (gate.ok === false) return { success: false, error: gate.error };
  const gatewayCustomerId = input.profile.authorize_customer_profile_id;
  const gatewayPaymentProfileId = input.profile.authorize_payment_profile_id;
  if (!gatewayCustomerId || !gatewayPaymentProfileId) {
    return { success: false, error: 'Add a payment method before buying from the shop.' };
  }
  const charge = await getPaymentProviderForProcessor(input.profile.processor).chargeOnce({
    organizationId: input.organizationId,
    memberId: input.memberId,
    gatewayCustomerId,
    gatewayPaymentProfileId,
    amountCents: input.amountCents,
    description: input.description,
    idempotencyKey: input.idempotencyKey,
  });
  return {
    success: charge.success,
    transactionId: charge.transactionId,
    error: charge.error,
  };
}

async function activateAddonPlan(
  supabase: AnyClient,
  input: {
    organizationId: string;
    memberId: string;
    planId: string;
    source: 'portal_shop' | 'staff_addon';
    existing: MembershipLayerRow[];
    charger?: ShopCharger;
  },
): Promise<{ membershipId: string; enrollmentId: string; queued?: boolean }> {
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, name, monthly_share, metadata, is_active')
    .eq('id', input.planId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (planErr || !plan) throw new Error(planErr?.message ?? 'Plan not found');
  if (plan.is_active === false) throw new Error('That plan is not available');

  const shop = parseShopTerms(plan.metadata);
  const allowed = decideMembershipAdd({
    existing: input.existing,
    next: { plan_id: plan.id, layer: 'addon', sponsored: false },
  });
  if (allowed.ok === false) throw new Error(allowed.error);

  const amount = Number(plan.monthly_share) || 0;
  const amountCents = shopPeriodAmountCents(amount, shop.frequency);
  const profile = await defaultPaymentProfile(supabase, input.organizationId, input.memberId);
  const idem = shopChargeIdempotencyKey({
    memberId: input.memberId,
    itemType: 'plan',
    itemId: plan.id,
    period: shopChargePeriod(),
  });
  const charge = input.charger
    ? await input.charger({
        organizationId: input.organizationId,
        memberId: input.memberId,
        amountCents,
        description: `Shop add-on — ${plan.name}`,
        idempotencyKey: idem,
      })
    : await defaultChargeShopItem({
        supabase,
        organizationId: input.organizationId,
        memberId: input.memberId,
        amountCents,
        description: `Shop add-on — ${plan.name}`,
        idempotencyKey: idem,
        profile,
      });
  if (!shouldProvisionAfterShopCharge(charge)) {
    throw new Error(charge.error ?? 'The payment was declined.');
  }
  if (charge.enrollmentId) {
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('enrollment_id', charge.enrollmentId)
      .maybeSingle();
    if (existingMembership?.id) {
      return {
        membershipId: existingMembership.id as string,
        enrollmentId: charge.enrollmentId,
        queued: charge.queued,
      };
    }
  }

  const effectiveDate = todayIso();
  const { data: enrollment, error: enrErr } = await supabase
    .from('enrollments')
    .insert({
      organization_id: input.organizationId,
      primary_member_id: input.memberId,
      selected_plan_id: plan.id,
      status: 'approved',
      enrollment_mode: input.source === 'staff_addon' ? 'internal_ops' : 'member_self_serve',
      enrollment_source: input.source,
      effective_date: effectiveDate,
      requested_effective_date: effectiveDate,
      base_monthly_cost: amount,
      total_monthly_cost: amount,
      permanent_bill_day: 20,
      advisor_id: null,
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (enrErr || !enrollment) throw new Error(enrErr?.message ?? 'Could not create add-on enrollment');

  const membership = await insertMembership(supabase, {
    organization_id: input.organizationId,
    member_id: input.memberId,
    plan_id: plan.id,
    enrollment_id: enrollment.id,
    status: 'active',
    effective_date: effectiveDate,
    billing_amount: amount,
    billing_frequency: shop.frequency ?? 'monthly',
    layer: 'addon',
    custom_fields: withMembershipLayer({}, 'addon'),
  });

  if (profile?.id) {
    await supabase
      .from('billing_schedules')
      .update({
        payment_profile_id: profile.id,
        billing_frequency: shop.frequency ?? 'monthly',
      })
      .eq('enrollment_id', enrollment.id)
      .eq('organization_id', input.organizationId)
      .eq('status', 'active');
  }

  if (charge.queued) {
    await attachQueuedShopCharge(supabase, {
      organizationId: input.organizationId,
      transactionId: charge.transactionId,
      enrollmentId: enrollment.id,
    });
  }

  return { membershipId: membership.id, enrollmentId: enrollment.id, queued: charge.queued };
}

async function purchasePackage(
  supabase: AnyClient,
  input: {
    organizationId: string;
    memberId: string;
    packageId: string;
    quantity: number;
    createdBy?: string | null;
    charger?: ShopCharger;
  },
): Promise<{ memberPackageId: string; invoiceId: string }> {
  const { data: pack, error } = await supabase
    .from('packages')
    .select('id, name, price, tax_rate, units, unit_label, is_active')
    .eq('id', input.packageId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) throw new Error('Package tables are not applied yet');
    throw new Error(error.message);
  }
  if (!pack || pack.is_active === false) throw new Error('Package not found');

  const money = packagePurchaseAmounts({
    price: Number(pack.price),
    taxRate: Number(pack.tax_rate) || 0,
    quantity: input.quantity,
  });
  const units = Math.max(1, Number(pack.units) || 1) * Math.max(1, input.quantity);
  const amountCents = Math.round(money.total * 100);
  const profile = await defaultPaymentProfile(supabase, input.organizationId, input.memberId);
  const achCart = shopAchCartGuard({
    paymentType: profile?.payment_type,
    itemTypes: ['package'],
  });
  if (achCart.ok === false) throw new Error(achCart.error);
  const idem = shopChargeIdempotencyKey({
    memberId: input.memberId,
    itemType: 'package',
    itemId: pack.id,
    period: shopChargePeriod(),
  });
  const charge = input.charger
    ? await input.charger({
        organizationId: input.organizationId,
        memberId: input.memberId,
        amountCents,
        description: `Shop package — ${pack.name}`,
        idempotencyKey: idem,
      })
    : await defaultChargeShopItem({
        supabase,
        organizationId: input.organizationId,
        memberId: input.memberId,
        amountCents,
        description: `Shop package — ${pack.name}`,
        idempotencyKey: idem,
        profile,
      });
  if (!shouldProvisionAfterShopCharge(charge)) {
    throw new Error(charge.error ?? 'The payment was declined.');
  }

  const invoice = await generateMemberInvoice(supabase, {
    organizationId: input.organizationId,
    memberId: input.memberId,
    title: `Package: ${pack.name}`,
    dueDate: addDaysIso(14),
    taxRate: Number(pack.tax_rate) || 0,
    createdBy: input.createdBy ?? null,
    notes: 'Portal shop package purchase. Charged at checkout.',
    lines: [
      {
        name: pack.name,
        description: `${units} ${pack.unit_label || 'units'}`,
        quantity: input.quantity,
        unit_price: Number(pack.price),
      },
    ],
  });

  const { data: purchased, error: buyErr } = await supabase
    .from('member_packages')
    .insert({
      organization_id: input.organizationId,
      member_id: input.memberId,
      package_id: pack.id,
      invoice_id: invoice.id,
      units_purchased: units,
      units_remaining: units,
      price_paid: money.total,
      tax_amount: money.tax_amount,
      deferred_revenue_remaining: money.total,
      status: 'active',
      purchased_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (buyErr || !purchased) throw new Error(buyErr?.message ?? 'Could not record package purchase');

  if (money.total > 0) {
    await applyInvoicePayment(supabase, {
      organizationId: input.organizationId,
      invoiceId: invoice.id,
      amount: money.total,
      kind: 'payment',
      paymentMethod: 'card',
      referenceNumber: charge.transactionId ?? idem,
      notes: 'Shop checkout charge',
    });
  }

  return { memberPackageId: purchased.id, invoiceId: invoice.id };
}

export async function checkoutShopItems(
  supabase: AnyClient,
  input: {
    organizationId: string;
    memberId: string;
    items: ShopCartItemInput[];
    createdBy?: string | null;
    source?: 'portal_shop' | 'staff_addon';
    charger?: ShopCharger;
  },
): Promise<{
  memberships: Array<{ membershipId: string; enrollmentId: string; planId: string }>;
  packages: Array<{ memberPackageId: string; invoiceId: string; packageId: string }>;
  queued: boolean;
}> {
  const items = normalizeCartItems(input.items);
  if (items.length === 0) throw new Error('Cart is empty');

  const profile = await defaultPaymentProfile(supabase, input.organizationId, input.memberId);
  const achCart = shopAchCartGuard({
    paymentType: profile?.payment_type,
    itemTypes: items.map((item) => item.item_type),
  });
  if (achCart.ok === false) throw new Error(achCart.error);

  const existing = await loadOpenMemberships(supabase, input.organizationId, input.memberId);
  const memberships: Array<{ membershipId: string; enrollmentId: string; planId: string }> = [];
  const packages: Array<{ memberPackageId: string; invoiceId: string; packageId: string }> = [];
  let queued = false;

  for (const item of items) {
    if (item.item_type === 'plan' && item.plan_id) {
      const created = await activateAddonPlan(supabase, {
        organizationId: input.organizationId,
        memberId: input.memberId,
        planId: item.plan_id,
        source: input.source ?? 'portal_shop',
        existing,
        charger: input.charger,
      });
      existing.push({
        id: created.membershipId,
        status: 'active',
        plan_id: item.plan_id,
        sponsor_id: null,
        layer: 'addon',
        custom_fields: { layer: 'addon' },
      });
      if (created.queued) queued = true;
      memberships.push({ ...created, planId: item.plan_id });
    }
    if (item.item_type === 'package' && item.package_id) {
      const created = await purchasePackage(supabase, {
        organizationId: input.organizationId,
        memberId: input.memberId,
        packageId: item.package_id,
        quantity: item.quantity ?? 1,
        createdBy: input.createdBy,
        charger: input.charger,
      });
      packages.push({ ...created, packageId: item.package_id });
    }
  }

  return { memberships, packages, queued };
}

export async function redeemMemberPackage(
  supabase: AnyClient,
  input: {
    organizationId: string;
    memberPackageId: string;
    units: number;
    notes?: string | null;
    redeemedBy?: string | null;
  },
) {
  const { planPackageRedeem } = await import('./packages');
  const { data: row, error } = await supabase
    .from('member_packages')
    .select('id, units_remaining, units_purchased, deferred_revenue_remaining, status, expires_at')
    .eq('id', input.memberPackageId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (error || !row) throw new Error(error?.message ?? 'Package purchase not found');
  if (row.status !== 'active') throw new Error('This package is not active');
  if (row.expires_at && row.expires_at < todayIso()) throw new Error('This package has expired');

  const planned = planPackageRedeem({
    unitsRemaining: Number(row.units_remaining),
    redeemUnits: input.units,
    deferredRemaining: Number(row.deferred_revenue_remaining) || 0,
    unitsPurchased: Number(row.units_purchased) || Number(row.units_remaining),
  });
  if ('ok' in planned) throw new Error(planned.error);

  const { error: redErr } = await supabase.from('member_package_redemptions').insert({
    organization_id: input.organizationId,
    member_package_id: row.id,
    units: input.units,
    notes: input.notes ?? null,
    redeemed_by: input.redeemedBy ?? null,
  });
  if (redErr) throw new Error(redErr.message);

  const { error: updErr } = await supabase
    .from('member_packages')
    .update({
      units_remaining: planned.remaining,
      deferred_revenue_remaining: planned.deferred_remaining,
      status: planned.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (updErr) throw new Error(updErr.message);

  return planned;
}
