import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { verifyDomain } from '@/lib/email/domain-verification';

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

// POST /api/settings/email-domains/[id]/verify - Verify domain DNS
export async function POST(
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

    // Get domain
    const { data: domain, error: domainError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (domainError || !domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    // Update status to verifying
    await supabase
      .from('email_domains')
      .update({ status: 'verifying' })
      .eq('id', id);

    // Perform DNS verification
    const result = await verifyDomain(
      domain.domain,
      domain.dkim_selector,
      domain.verification_token
    );

    // Update domain with results
    const newStatus = result.allVerified ? 'verified' : 'pending';
    const { data: updatedDomain, error: updateError } = await supabase
      .from('email_domains')
      .update({
        status: newStatus,
        dkim_verified: result.dkim,
        spf_verified: result.spf,
        dmarc_verified: result.dmarc,
        mx_verified: result.mx,
        last_verified_at: new Date().toISOString(),
        error_message: result.error || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      domain: updatedDomain,
      verification: result,
    });
  } catch (error) {
    console.error('Error verifying domain:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
