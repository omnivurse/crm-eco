import { NextResponse } from 'next/server';
import { employeeInviteHtml, sendSponsorInviteEmail } from '@crm-eco/lib';
import { requireSponsorStaff } from '@/lib/sponsors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSponsorStaff();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { rosterId?: string } | null;
  if (!body?.rosterId) {
    return NextResponse.json({ error: 'rosterId is required' }, { status: 400 });
  }

  const { data: sponsor } = await auth.supabase
    .from('sponsors')
    .select('id, name, organization_id')
    .eq('id', id)
    .eq('organization_id', auth.tenant.organizationId)
    .maybeSingle();
  if (!sponsor) return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });

  const { data: person } = await auth.supabase
    .from('sponsor_roster')
    .select('id, first_name, email, status')
    .eq('id', body.rosterId)
    .eq('sponsor_id', id)
    .maybeSingle();
  if (!person?.email) {
    return NextResponse.json({ error: 'That roster person has no email' }, { status: 400 });
  }

  const { data: landing } = await auth.supabase
    .from('landing_pages')
    .select('slug')
    .eq('organization_id', auth.tenant.organizationId)
    .eq('sponsor_id', id)
    .eq('is_published', true)
    .limit(1)
    .maybeSingle();

  const portalBase =
    process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://members.payitforwardhealth.com';
  const enrollUrl = landing?.slug
    ? `${portalBase}/enroll/${landing.slug}`
    : `${portalBase}/enroll`;

  const invite = await sendSponsorInviteEmail({
    to: person.email,
    subject: `Enroll with ${sponsor.name}`,
    html: employeeInviteHtml({
      sponsorName: sponsor.name,
      enrollUrl,
      firstName: person.first_name,
    }),
  });

  await auth.supabase
    .from('sponsor_roster')
    .update({ last_invited_at: new Date().toISOString() })
    .eq('id', person.id);

  return NextResponse.json({ invite, enrollUrl });
}
