/**
 * GET /api/crm/records/[id]/related/[kind]
 *
 * Record-scoped related-list data for the V2 detail shell.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import {
  fetchRecordCampaigns,
  fetchRecordCadences,
  fetchRecordMeetings,
  fetchRecordVisits,
  fetchRecordSocial,
  fetchRecordProducts,
  isRelatedListKind,
} from '@/lib/crm/record-related-lists';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  const { id, kind } = await context.params;

  if (!id) {
    return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
  }
  if (!isRelatedListKind(kind)) {
    return NextResponse.json({ error: 'Unknown related list kind' }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createCrmClient();

  const { data: record, error: recordError } = await supabase
    .from('crm_records')
    .select('id, email')
    .eq('id', id)
    .eq('org_id', profile.organization_id)
    .maybeSingle();

  if (recordError) {
    return NextResponse.json({ error: recordError.message }, { status: 500 });
  }
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const inviteeEmail = searchParams.get('email') ?? (record.email as string | null);

    let items: unknown[];
    switch (kind) {
      case 'campaigns':
        items = await fetchRecordCampaigns(supabase, id);
        break;
      case 'cadences':
        items = await fetchRecordCadences(supabase, id);
        break;
      case 'meetings':
        items = await fetchRecordMeetings(supabase, id, inviteeEmail);
        break;
      case 'visits':
        items = await fetchRecordVisits(supabase, id);
        break;
      case 'social':
        items = await fetchRecordSocial(supabase, id);
        break;
      case 'products':
        items = await fetchRecordProducts(supabase, id);
        break;
      default:
        items = [];
    }

    return NextResponse.json({ kind, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load related list';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
