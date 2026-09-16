import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  hrefAllowed,
  runGizmoTurn,
  sanitizeRecordHits,
  shouldSearchRecords,
} from '@crm-eco/lib/gizmo';
import { MEMBER_PORTAL_HOWTO, MEMBER_PORTAL_PLACES } from '@crm-eco/lib/gizmo/catalogs/member-portal';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const member = ctx.member;

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
    app_id: 'member_portal',
    q: createHash('sha256').update(query).digest('hex').slice(0, 12),
    actorId: ctx.profile.id,
  });

  const selfName = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
  const selfHay = [selfName, member.email, member.id].filter(Boolean).join(' ').toLowerCase();
  const records =
    shouldSearchRecords('member_portal', query) && selfHay.includes(query.toLowerCase())
      ? sanitizeRecordHits('member_portal', [
          {
            title: selfName || 'Your membership',
            subtitle: member.email ?? undefined,
            href: '/coverage',
            module: 'self',
          },
        ])
      : [];

  const turn = runGizmoTurn({
    app: 'member_portal',
    query,
    places: MEMBER_PORTAL_PLACES.filter((p) => hrefAllowed('member_portal', p.href)),
    howto: MEMBER_PORTAL_HOWTO.filter((h) => hrefAllowed('member_portal', h.href)),
    records,
    pathname: body.pathname,
    pageTitle: body.pageTitle,
    pageTips: body.pageTips,
    role: 'member',
  });

  if (turn.cards.some((c) => c.href.startsWith('/crm') || !hrefAllowed('member_portal', c.href))) {
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
