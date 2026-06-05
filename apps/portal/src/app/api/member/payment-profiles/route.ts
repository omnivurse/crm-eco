import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { listPaymentProfiles } from '@/lib/data/billing';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profiles = await listPaymentProfiles();
  return NextResponse.json({ profiles });
}

interface CreatePaymentProfileBody {
  opaqueData: {
    dataDescriptor: string;
    dataValue: string;
  };
  expirationDate: string;
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
    });
  } catch (error) {
    console.error('[portal] create payment profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
