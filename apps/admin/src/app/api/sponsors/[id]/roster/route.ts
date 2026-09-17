import { NextResponse } from 'next/server';
import { importSponsorRoster } from '@crm-eco/lib';
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
    csvText?: string;
    mode?: 'dry_run' | 'apply';
    enrollMode?: 'eligible_only' | 'known_roster';
    filename?: string;
  } | null;

  if (!body?.csvText?.trim()) {
    return NextResponse.json({ error: 'csvText is required' }, { status: 400 });
  }
  if (body.mode !== 'dry_run' && body.mode !== 'apply') {
    return NextResponse.json({ error: 'mode must be dry_run or apply' }, { status: 400 });
  }

  const { data: sponsor, error: sponsorErr } = await auth.supabase
    .from('sponsors')
    .select('id')
    .eq('id', id)
    .eq('organization_id', auth.tenant.organizationId)
    .maybeSingle();

  if (sponsorErr || !sponsor) {
    return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
  }

  try {
    const result = await importSponsorRoster(auth.supabase, {
      organizationId: auth.tenant.organizationId,
      sponsorId: id,
      csvText: body.csvText,
      mode: body.mode,
      enrollMode: body.enrollMode === 'known_roster' ? 'known_roster' : 'eligible_only',
      filename: body.filename,
      actorId: auth.user.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Roster import failed' },
      { status: 500 }
    );
  }
}
