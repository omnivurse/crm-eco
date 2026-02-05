import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { generateDkimSelector, generateVerificationToken } from '@/lib/email/domain-verification';

// GET /api/settings/email-domains - List domains
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get domains with sender addresses
    const { data: domains, error } = await supabase
      .from('email_domains')
      .select(`
        *,
        sender_addresses:email_sender_addresses(*)
      `)
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ domains: domains || [] });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 });
  }
}

// POST /api/settings/email-domains - Add domain
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Validate domain format
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Check if domain already exists
    const { data: existing } = await supabase
      .from('email_domains')
      .select('id')
      .eq('org_id', profile.organization_id)
      .eq('domain', domain.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Domain already exists' }, { status: 409 });
    }

    // Generate verification records
    const dkimSelector = generateDkimSelector();
    const verificationToken = generateVerificationToken();

    // Create domain
    const { data: newDomain, error } = await supabase
      .from('email_domains')
      .insert({
        org_id: profile.organization_id,
        domain: domain.toLowerCase(),
        status: 'pending',
        dkim_selector: dkimSelector,
        verification_token: verificationToken,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newDomain, { status: 201 });
  } catch (error) {
    console.error('Error adding domain:', error);
    return NextResponse.json({ error: 'Failed to add domain' }, { status: 500 });
  }
}
