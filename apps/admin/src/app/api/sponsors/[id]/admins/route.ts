import { NextResponse } from 'next/server';
import { requireSponsorStaff } from '@/lib/sponsors';
import { sendSponsorInviteEmail, sponsorAdminInviteHtml } from '@crm-eco/lib';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSponsorStaff();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    role?: 'admin' | 'billing' | 'roster';
  } | null;

  const email = body?.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const role = body?.role ?? 'admin';
  if (!['admin', 'billing', 'roster'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const { data: sponsor } = await auth.supabase
    .from('sponsors')
    .select('id')
    .eq('id', id)
    .eq('organization_id', auth.tenant.organizationId)
    .maybeSingle();

  if (!sponsor) {
    return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
  }

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('user_id')
    .eq('organization_id', auth.tenant.organizationId)
    .ilike('email', email)
    .maybeSingle();

  const { data: row, error } = await auth.supabase
    .from('sponsor_admins')
    .upsert(
      {
        organization_id: auth.tenant.organizationId,
        sponsor_id: id,
        email,
        role,
        user_id: profile?.user_id ?? null,
        accepted_at: profile?.user_id ? new Date().toISOString() : null,
      },
      { onConflict: 'sponsor_id,email' }
    )
    .select('id, email, role, user_id, accepted_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await auth.supabase
    .from('sponsor_admins')
    .update({ last_invited_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(() => undefined)
    .catch(() => undefined);

  const portalBase =
    process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://members.payitforwardhealth.com';
  const invite = await sendSponsorInviteEmail({
    to: email,
    subject: 'Employer portal invite',
    html: sponsorAdminInviteHtml({
      sponsorName: 'your company',
      employerUrl: `${portalBase}/employer`,
    }),
  });

  return NextResponse.json({
    admin: row,
    linked: Boolean(profile?.user_id),
    invite,
    note: invite.sent
      ? 'Invite emailed.'
      : invite.dryRun
        ? 'Invite stored. Email is dry-run until SPONSOR_EMAIL_ENABLED=true.'
        : invite.error ?? 'Invite stored.',
  });
}
