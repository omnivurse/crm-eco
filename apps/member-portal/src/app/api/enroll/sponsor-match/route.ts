import { NextResponse } from 'next/server';
import { matchSponsorEnrollment, shouldSkipMemberChargeForSponsor } from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  } | null;
  if (!body?.slug || !body.firstName || !body.lastName) {
    return NextResponse.json({ error: 'slug, firstName, and lastName are required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient() as any;
  const { data: landing } = await supabase
    .from('landing_pages')
    .select('organization_id, sponsor_id')
    .eq('slug', body.slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!landing?.sponsor_id) {
    return NextResponse.json({ sponsorPaid: false, outcome: 'no_sponsor' });
  }

  const decision = await matchSponsorEnrollment(supabase, {
    organizationId: landing.organization_id,
    sponsorId: landing.sponsor_id,
    firstName: body.firstName,
    lastName: body.lastName,
    dateOfBirth: body.dateOfBirth,
  });

  return NextResponse.json({
    outcome: decision.outcome,
    sponsorPaid: shouldSkipMemberChargeForSponsor(decision.outcome),
    reason: decision.reason,
  });
}
