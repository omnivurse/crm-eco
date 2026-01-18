import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string } | null };

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user has domain restrictions
    // Note: Using type assertion since user_email_settings table is not in generated types yet
    const { data: userSettings } = await (supabase as any)
      .from('user_email_settings')
      .select('allowed_domain_ids')
      .eq('profile_id', profile.id)
      .single();

    const allowedDomainIds = userSettings?.allowed_domain_ids || [];

    // Build query for sender addresses
    let query = supabase
      .from('email_sender_addresses')
      .select(`
        id,
        email,
        name,
        is_default,
        is_verified,
        domain_id,
        email_domains!inner (
          id,
          domain,
          status
        )
      `)
      .eq('org_id', profile.organization_id)
      .eq('email_domains.status', 'verified');

    // If user has domain restrictions, filter by allowed domains
    if (allowedDomainIds.length > 0) {
      query = query.in('domain_id', allowedDomainIds);
    }

    const { data: senderAddresses, error } = await query.order('is_default', { ascending: false });

    if (error) {
      console.error('Error fetching sender addresses:', error);
      return NextResponse.json({ error: 'Failed to fetch sender addresses' }, { status: 500 });
    }

    // Transform data to include domain string
    const addresses = (senderAddresses || []).map((addr: any) => ({
      id: addr.id,
      email: addr.email,
      name: addr.name || '',
      domain: addr.email_domains?.domain || '',
      is_default: addr.is_default,
      is_verified: addr.is_verified,
    }));

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('Sender addresses GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
