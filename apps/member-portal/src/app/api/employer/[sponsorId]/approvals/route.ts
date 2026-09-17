import { NextResponse } from 'next/server';
import { applySponsorshipDecision } from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireEmployerSponsors } from '@/lib/employer';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sponsorId: string }> },
) {
  const ctx = await requireEmployerSponsors();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sponsorId } = await params;
  const sponsor = ctx.sponsors.find((s) => s.id === sponsorId);
  if (!sponsor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    sponsorshipId?: string;
    decision?: 'approve' | 'deny';
  } | null;
  if (!body?.sponsorshipId || (body.decision !== 'approve' && body.decision !== 'deny')) {
    return NextResponse.json({ error: 'sponsorshipId and decision are required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient() as any;
  try {
    const result = await applySponsorshipDecision(supabase, {
      organizationId: sponsor.organization_id,
      sponsorId,
      sponsorshipId: body.sponsorshipId,
      decision: body.decision,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not decide sponsorship' },
      { status: 400 },
    );
  }
}
