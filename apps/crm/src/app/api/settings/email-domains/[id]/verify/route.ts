import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { verifyDomain } from '@/lib/email/domain-verification';

// POST /api/settings/email-domains/[id]/verify - Verify domain DNS
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { id } = await params;

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
