import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { NMI_OPAQUE_DESCRIPTOR } from '@crm-eco/lib/billing/nmi';
import { createNmiPaymentProvider } from '@crm-eco/lib/billing';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { listPaymentProfiles } from '@/lib/data/billing';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profiles = await listPaymentProfiles();
  return NextResponse.json({ profiles });
}

interface CreatePaymentProfileBody {
  type?: 'opaque';
  opaqueData: {
    dataDescriptor: string;
    dataValue: string;
  };
  expirationDate?: string;
  billingAddress: {
    firstName: string;
    lastName: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  setAsDefault?: boolean;
}

function isNmiOpaque(descriptor: string | undefined): boolean {
  const value = (descriptor ?? '').trim();
  return value === NMI_OPAQUE_DESCRIPTOR || value === 'payment_token';
}

async function vaultNmiProfile(
  ctx: Awaited<ReturnType<typeof requireActiveMembership>>,
  body: CreatePaymentProfileBody,
) {
  const provider = createNmiPaymentProvider();
  const vault = await provider.vaultPaymentMethod({
    organizationId: ctx.member.organization_id,
    memberId: ctx.member.id,
    email: ctx.member.email || ctx.profile.email,
    method: {
      type: 'opaque',
      descriptor: NMI_OPAQUE_DESCRIPTOR,
      value: body.opaqueData.dataValue,
    },
    billingAddress: {
      firstName: body.billingAddress.firstName.trim(),
      lastName: body.billingAddress.lastName.trim(),
      line1: body.billingAddress.address,
      city: body.billingAddress.city,
      state: body.billingAddress.state,
      zip: body.billingAddress.zip,
    },
  });

  if (!vault.success || !vault.gatewayCustomerId || !vault.gatewayPaymentProfileId) {
    return NextResponse.json(
      { error: vault.error || 'Failed to vault NMI payment method' },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const setAsDefault = body.setAsDefault ?? true;
  if (setAsDefault) {
    await supabase
      .from('payment_profiles')
      .update({ is_default: false })
      .eq('member_id', ctx.member.id)
      .eq('is_active', true);
  }

  const lastFour = vault.lastFour || '0000';
  const expiration =
    vault.expiration ??
    (body.expirationDate && /^\d{4}-\d{2}$/.test(body.expirationDate) ? body.expirationDate : null);

  const { data: profile, error } = await supabase
    .from('payment_profiles')
    .insert({
      organization_id: ctx.member.organization_id,
      member_id: ctx.member.id,
      authorize_customer_profile_id: vault.gatewayCustomerId,
      authorize_payment_profile_id: vault.gatewayPaymentProfileId,
      payment_type: vault.paymentType ?? 'credit_card',
      last_four: lastFour,
      card_last4: lastFour,
      card_type: vault.brand ?? null,
      expiration_date: expiration,
      billing_first_name: body.billingAddress.firstName.trim(),
      billing_last_name: body.billingAddress.lastName.trim(),
      billing_address: body.billingAddress.address ?? null,
      billing_city: body.billingAddress.city ?? null,
      billing_state: body.billingAddress.state ?? null,
      billing_zip: body.billingAddress.zip ?? null,
      is_default: setAsDefault,
      is_active: true,
      status: 'active',
      processor: 'nmi',
    })
    .select('id')
    .single();

  if (error || !profile) {
    console.error('[portal] NMI payment profile persist failed:', error?.message);
    return NextResponse.json({ error: 'Failed to save payment profile' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    paymentProfileId: profile.id,
    lastFour,
    cardType: vault.brand,
    processor: 'nmi',
  });
}

export async function POST(request: Request) {
  try {
    const ctx = await requireActiveMembership();
    const body = (await request.json()) as CreatePaymentProfileBody;

    if (!body.opaqueData?.dataDescriptor || !body.opaqueData?.dataValue) {
      return NextResponse.json({ error: 'Missing payment token' }, { status: 400 });
    }

    if (!body.billingAddress?.firstName?.trim() || !body.billingAddress?.lastName?.trim()) {
      return NextResponse.json({ error: 'Billing name is required' }, { status: 400 });
    }

    if (isNmiOpaque(body.opaqueData.dataDescriptor)) {
      return vaultNmiProfile(ctx, body);
    }

    if (!/^\d{4}-\d{2}$/.test(body.expirationDate ?? '')) {
      return NextResponse.json({ error: 'Invalid expiration date' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/process-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        action: 'create_profile',
        memberId: ctx.member.id,
        opaqueData: body.opaqueData,
        expirationDate: body.expirationDate,
        billingAddress: body.billingAddress,
        setAsDefault: body.setAsDefault ?? true,
      }),
    });

    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
      paymentProfileId?: string;
      lastFour?: string;
      cardType?: string;
    };

    if (!response.ok || !result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create payment profile' },
        { status: response.status >= 400 ? response.status : 400 },
      );
    }

    return NextResponse.json({
      success: true,
      paymentProfileId: result.paymentProfileId,
      lastFour: result.lastFour,
      cardType: result.cardType,
      processor: 'authorizenet',
    });
  } catch (error) {
    console.error('[portal] create payment profile error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const failClosed =
      /NMI_PRIVATE_API_KEY|NMI payment provider|Unknown PAYMENT_PROVIDER/i.test(message);
    return NextResponse.json(
      { error: failClosed ? message : 'Internal server error' },
      { status: failClosed ? 500 : 500 },
    );
  }
}
