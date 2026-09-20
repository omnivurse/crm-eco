import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  hrefAllowed,
  parseRecordQuery,
  runGizmoTurn,
  shouldSearchRecords,
} from '@crm-eco/lib/gizmo';
import { ADVISOR_PORTAL_HOWTO, ADVISOR_PORTAL_PLACES } from '@crm-eco/lib/gizmo/catalogs/advisor-portal';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { searchAdvisorRecords } from '@/lib/gizmo/search-records';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, advisor_role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.advisor_role) {
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
    app_id: 'advisor_portal',
    q: createHash('sha256').update(query).digest('hex').slice(0, 12),
    actorId: profile.id,
  });

  const parsed = parseRecordQuery(query);
  const records =
    shouldSearchRecords('advisor_portal', query) && parsed.shouldSearch && parsed.searchTerm.trim()
      ? await searchAdvisorRecords(parsed.searchTerm)
      : [];

  const turn = runGizmoTurn({
    app: 'advisor_portal',
    query,
    places: ADVISOR_PORTAL_PLACES.filter((p) => hrefAllowed('advisor_portal', p.href)),
    howto: ADVISOR_PORTAL_HOWTO.filter((h) => hrefAllowed('advisor_portal', h.href)),
    records,
    pathname: body.pathname,
    pageTitle: body.pageTitle,
    pageTips: body.pageTips,
    role: profile.advisor_role,
  });

  if (turn.cards.some((c) => c.href.startsWith('/crm') || !hrefAllowed('advisor_portal', c.href))) {
    return NextResponse.json({
      reply: "That's not in this workspace.",
      cards: [],
      refused: true,
      usedTools: turn.usedTools,
    });
  }

  return NextResponse.json({
    reply: turn.reply,
    cards: turn.cards,
    refused: turn.refused,
    usedTools: turn.usedTools,
  });
}
