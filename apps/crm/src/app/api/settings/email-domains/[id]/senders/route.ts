import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

// GET /api/settings/email-domains/[id]/senders - List sender addresses for domain
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

    // Verify domain belongs to org
    const { data: domain } = await supabase
      .from('email_domains')
      .select('id')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    // Get sender addresses
    const { data: senders, error } = await supabase
      .from('email_sender_addresses')
      .select('*')
      .eq('domain_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ senders: senders || [] });
  } catch (error) {
    console.error('Error fetching sender addresses:', error);
    return NextResponse.json({ error: 'Failed to fetch sender addresses' }, { status: 500 });
  }
}

// POST /api/settings/email-domains/[id]/senders - Add sender address
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { email, name, isDefault } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

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

    // Verify domain belongs to org and get domain name
    const { data: domain } = await supabase
      .from('email_domains')
      .select('id, domain, status')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    // Verify email matches domain
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (emailDomain !== domain.domain.toLowerCase()) {
      return NextResponse.json({
        error: `Email must use the domain ${domain.domain}`
      }, { status: 400 });
    }

    // Check if sender already exists
    const { data: existing } = await supabase
      .from('email_sender_addresses')
      .select('id')
      .eq('org_id', profile.organization_id)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Sender address already exists' }, { status: 409 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('email_sender_addresses')
        .update({ is_default: false })
        .eq('org_id', profile.organization_id);
    }

    // Create sender address
    const { data: sender, error } = await supabase
      .from('email_sender_addresses')
      .insert({
        org_id: profile.organization_id,
        domain_id: id,
        email: email.toLowerCase(),
        name: name || null,
        is_default: isDefault || false,
        is_verified: domain.status === 'verified',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(sender, { status: 201 });
  } catch (error) {
    console.error('Error adding sender address:', error);
    return NextResponse.json({ error: 'Failed to add sender address' }, { status: 500 });
  }
}
