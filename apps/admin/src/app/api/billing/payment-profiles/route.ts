import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createBillingService, type PaymentMethod, type BillingAddress } from '@crm-eco/lib/billing';

/**
 * GET /api/billing/payment-profiles?memberId=xxx
 * Get payment profiles for a member
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string; role: string } | null };

    if (!profile || !['owner', 'admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { error: 'Missing required parameter: memberId' },
        { status: 400 }
      );
    }

    // Verify member belongs to organization
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('id', memberId)
      .eq('organization_id', profile.organization_id)
      .single() as { data: { id: string } | null };

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Get payment profiles
    const billingService = createBillingService(supabase, profile.organization_id);
    const profiles = await billingService.getPaymentProfiles(memberId);

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Get payment profiles error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/payment-profiles
 * Create a new payment profile for a member
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string; role: string } | null };

    if (!profile || !['owner', 'admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      memberId,
      paymentMethod,
      billingAddress,
      setAsDefault,
      nickname,
    } = body as {
      memberId: string;
      paymentMethod: PaymentMethod;
      billingAddress?: BillingAddress;
      setAsDefault?: boolean;
      nickname?: string;
    };

    // Validate required fields
    if (!memberId || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: memberId, paymentMethod' },
        { status: 400 }
      );
    }

    // Verify member belongs to organization
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('id', memberId)
      .eq('organization_id', profile.organization_id)
      .single() as { data: { id: string } | null };

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Create payment profile
    const billingService = createBillingService(supabase, profile.organization_id);
    const newProfile = await billingService.createPaymentProfile({
      memberId,
      organizationId: profile.organization_id,
      paymentMethod,
      billingAddress,
      setAsDefault,
      nickname,
    });

    // Log activity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('log_admin_activity', {
      p_organization_id: profile.organization_id,
      p_actor_profile_id: profile.id,
      p_entity_type: 'payment_profile',
      p_entity_id: newProfile.id,
      p_action: 'create',
      p_metadata: {
        memberId,
        paymentType: paymentMethod.type,
        lastFour: newProfile.lastFour,
      },
    });

    return NextResponse.json({ profile: newProfile }, { status: 201 });
  } catch (error) {
    console.error('Create payment profile error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/billing/payment-profiles?profileId=xxx
 * Delete a payment profile
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string; role: string } | null };

    if (!profile || !['owner', 'admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json(
        { error: 'Missing required parameter: profileId' },
        { status: 400 }
      );
    }

    // Verify payment profile belongs to organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: paymentProfile } = await (supabase as any)
      .from('payment_profiles')
      .select('id, member_id')
      .eq('id', profileId)
      .eq('organization_id', profile.organization_id)
      .single() as { data: { id: string; member_id: string } | null };

    if (!paymentProfile) {
      return NextResponse.json({ error: 'Payment profile not found' }, { status: 404 });
    }

    // Delete payment profile
    const billingService = createBillingService(supabase, profile.organization_id);
    await billingService.deletePaymentProfile(profileId);

    // Log activity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('log_admin_activity', {
      p_organization_id: profile.organization_id,
      p_actor_profile_id: profile.id,
      p_entity_type: 'payment_profile',
      p_entity_id: profileId,
      p_action: 'delete',
      p_metadata: { memberId: paymentProfile.member_id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete payment profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
