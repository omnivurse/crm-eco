/**
 * GET /api/crm/records/[id]/insights
 *
 * Lightweight endpoint that returns live counts and "best time" suggestions
 * for a single CRM record. Used by `RecordDetailShellV2` to refresh the
 * right-rail insights panel after the user performs an action (logs a call,
 * adds a note, uploads an attachment, etc.) without requiring a full page
 * reload.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getRecordInsights } from '@/lib/crm/record-insights';
import { getCurrentProfile } from '@/lib/crm/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const insights = await getRecordInsights(id);
  return NextResponse.json(insights);
}
