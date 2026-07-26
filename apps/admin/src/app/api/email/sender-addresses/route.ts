import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenant = await getActiveTenant();
    if (!tenant || !['owner', 'admin', 'staff'].includes(tenant.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    const { data: senderAddresses, error } = await (supabase as any)
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
      .eq('org_id', tenant.organizationId)
      .eq('email_domains.status', 'verified')
      .order('is_default', { ascending: false })
      .order('email', { ascending: true });

    if (error) {
      console.error('Error fetching sender addresses:', error);
      return NextResponse.json({ error: 'Failed to fetch sender addresses' }, { status: 500 });
    }

    const addresses = (senderAddresses || []).map((addr: {
      id: string;
      email: string;
      name: string | null;
      is_default: boolean;
      is_verified: boolean;
      email_domains?: { domain?: string };
    }) => ({
      id: addr.id,
      email: addr.email,
      name: addr.name || '',
      domain: addr.email_domains?.domain || '',
      is_default: addr.is_default,
      is_verified: addr.is_verified,
    }));

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('Admin sender addresses GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
