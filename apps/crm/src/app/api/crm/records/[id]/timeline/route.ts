/**
 * GET /api/crm/records/[id]/timeline
 *
 * Returns the merged timeline events for a record as a flat sorted array.
 * V2's filterable timeline wrapper uses this endpoint so it can filter
 * events client-side by type (notes / activities / stage / attachments /
 * audit) without re-fetching.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  getCurrentProfile,
  getTimelineForRecordAggregated,
} from '@/lib/crm/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
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

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(
    Math.max(parseInt(limitParam || '100', 10) || 100, 10),
    500,
  );

  try {
    const events = await getTimelineForRecordAggregated(id, limit);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('[timeline API] failed:', err);
    return NextResponse.json({ events: [] });
  }
}
