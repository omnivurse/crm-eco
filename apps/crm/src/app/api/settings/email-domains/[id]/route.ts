import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getDnsRecords } from '@/lib/email/domain-verification';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// GET /api/settings/email-domains/[id] - Get domain with DNS records
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get domain with sender addresses
    const { data: domain, error } = await supabase
      .from('email_domains')
      .select(`
        *,
        sender_addresses:email_sender_addresses(*)
      `)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (error || !domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    // Generate DNS records for display
    const dnsRecords = getDnsRecords(
      domain.domain,
      domain.dkim_selector,
      domain.verification_token
    );

    // Update verified status on records
    dnsRecords[1].verified = domain.dkim_verified || false;
    dnsRecords[2].verified = domain.spf_verified || false;
    dnsRecords[3].verified = domain.dmarc_verified || false;

    return NextResponse.json({
      domain,
      dnsRecords,
    });
  } catch (error) {
    console.error('Error fetching domain:', error);
    return NextResponse.json({ error: 'Failed to fetch domain' }, { status: 500 });
  }
}

// DELETE /api/settings/email-domains/[id] - Delete domain
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Delete domain (will cascade to sender addresses)
    const { error } = await supabase
      .from('email_domains')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return NextResponse.json({ error: 'Failed to delete domain' }, { status: 500 });
  }
}
