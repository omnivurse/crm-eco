import { NextResponse } from 'next/server';
import { addSponsorRosterPerson, importSponsorRoster } from '@crm-eco/lib';
import { requireEmployerSponsors } from '@/lib/employer';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sponsorId: string }> }
) {
  const ctx = await requireEmployerSponsors();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sponsorId } = await params;
  const sponsor = ctx.sponsors.find((s) => s.id === sponsorId);
  if (!sponsor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    csvText?: string;
    mode?: 'dry_run' | 'apply';
    enrollMode?: 'eligible_only' | 'known_roster';
    person?: {
      first_name?: string;
      last_name?: string;
      date_of_birth?: string | null;
      email?: string | null;
      relationship?: 'employee' | 'spouse' | 'child';
    };
  } | null;

  const supabase = (await createServerSupabaseClient()) as any;

  try {
    if (body?.person) {
      await addSponsorRosterPerson(supabase, {
        organizationId: sponsor.organization_id,
        sponsorId,
        firstName: body.person.first_name ?? '',
        lastName: body.person.last_name ?? '',
        dateOfBirth: body.person.date_of_birth,
        email: body.person.email,
        relationship: body.person.relationship ?? 'employee',
      });
      return NextResponse.json({ ok: true });
    }

    if (!body?.csvText?.trim()) {
      return NextResponse.json({ error: 'csvText or person is required' }, { status: 400 });
    }
    if (body.mode !== 'dry_run' && body.mode !== 'apply') {
      return NextResponse.json({ error: 'mode must be dry_run or apply' }, { status: 400 });
    }

    const result = await importSponsorRoster(supabase, {
      organizationId: sponsor.organization_id,
      sponsorId,
      csvText: body.csvText,
      mode: body.mode,
      enrollMode: body.enrollMode === 'known_roster' ? 'known_roster' : 'eligible_only',
      actorId: ctx.userId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Roster import failed';
    const status = /cap|only one plan/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
