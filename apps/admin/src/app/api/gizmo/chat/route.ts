import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  looksLikeRecordQuery,
  runGizmoTurn,
  shouldSearchRecords,
} from '@crm-eco/lib/gizmo';
import { ADMIN_HOWTO, ADMIN_PLACES } from '@crm-eco/lib/gizmo/catalogs/admin';
import { getAdminProfile } from '@/lib/profile';
import { searchAdminRecords } from '@/lib/gizmo/search-records';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const profile = await getAdminProfile();
  if (!profile?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    pathname?: string;
    pageTitle?: string;
    pageTips?: { id: string; title: string; body: string }[];
  };
  const query = String(body.query ?? '').trim();
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  console.info('[gizmo]', {
    app_id: 'admin',
    q: createHash('sha256').update(query).digest('hex').slice(0, 12),
    actorId: profile.id,
  });

  const records =
    shouldSearchRecords('admin', query) && looksLikeRecordQuery(query)
      ? await searchAdminRecords(query)
      : [];

  const turn = runGizmoTurn({
    app: 'admin',
    query,
    places: ADMIN_PLACES,
    howto: ADMIN_HOWTO,
    records,
    pathname: body.pathname,
    pageTitle: body.pageTitle,
    pageTips: body.pageTips,
    role: profile.activeRole ?? profile.role,
  });

  return NextResponse.json({
    reply: turn.reply,
    cards: turn.cards,
    refused: turn.refused,
    usedTools: turn.usedTools,
  });
}
