import { NextResponse } from 'next/server';
import { generateSponsorInvoice } from '@crm-eco/lib';
import { getAdminProfile } from '@/lib/profile';
import { requireSponsorStaff } from '@/lib/sponsors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSponsorStaff();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    periodStart?: string;
    periodEnd?: string;
  } | null;

  if (!body?.periodStart || !body?.periodEnd) {
    return NextResponse.json({ error: 'periodStart and periodEnd are required' }, { status: 400 });
  }

  const profile = await getAdminProfile();

  try {
    const draft = await generateSponsorInvoice(auth.supabase, {
      organizationId: auth.tenant.organizationId,
      sponsorId: id,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      createdBy: profile?.id ?? null,
    });
    return NextResponse.json(draft);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invoice generation failed' },
      { status: 500 }
    );
  }
}
