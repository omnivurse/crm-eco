import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  attachAliasPlaces,
  hrefAllowed,
  parseRecordQuery,
  runGizmoTurn,
  shouldSearchRecords,
  stripDisallowedHrefs,
  type GizmoPlace,
} from '@crm-eco/lib/gizmo';
import { CRM_HOWTO, CRM_PLACES } from '@crm-eco/lib/gizmo/catalogs/crm';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { buildPalettePages } from '@/lib/crm/palette-pages';
import { searchCrmGizmoRecords } from '@/lib/gizmo/search-records';

export const dynamic = 'force-dynamic';

function hashQuery(q: string): string {
  return createHash('sha256').update(q).digest('hex').slice(0, 12);
}

export async function POST(request: NextRequest) {
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    pathname?: string;
    pageTitle?: string;
    pageTips?: { id: string; title: string; body: string }[];
    module?: string;
  };
  const query = String(body.query ?? '').trim();
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  console.info('[gizmo]', {
    app_id: 'crm',
    q: hashQuery(query),
    actorId: profile.id,
  });

  const supabase = await createClient();
  const { data: modules } = await supabase
    .from('crm_modules')
    .select('key, name, name_plural, icon, is_enabled, display_order')
    .eq('org_id', profile.organization_id)
    .eq('is_enabled', true)
    .order('display_order', { ascending: true });

  const pages = buildPalettePages({
    modules: (modules ?? []).map((m) => ({
      key: String(m.key),
      name: String(m.name),
      name_plural: m.name_plural ? String(m.name_plural) : null,
      icon: m.icon ? String(m.icon) : null,
      is_enabled: Boolean(m.is_enabled),
      display_order: Number(m.display_order ?? 0),
    })),
    crmRole: profile.crm_role,
  });

  const palettePlaces: GizmoPlace[] = pages
    .filter((p) => hrefAllowed('crm', p.href))
    .map((p) => ({
      id: p.key,
      title: p.label,
      href: p.href,
      aliases: p.keywords,
      group: p.tabLabel,
    }));
  const places = attachAliasPlaces(palettePlaces, CRM_PLACES, 'crm');

  const parsed = parseRecordQuery(query);
  const records =
    shouldSearchRecords('crm', query) && parsed.shouldSearch && parsed.searchTerm.trim()
      ? await searchCrmGizmoRecords(
          supabase,
          profile.organization_id,
          parsed.searchTerm,
          body.module?.trim() || null,
        )
      : [];

  const turn = runGizmoTurn({
    app: 'crm',
    query,
    places,
    howto: CRM_HOWTO,
    records,
    pathname: body.pathname,
    pageTitle: body.pageTitle,
    pageTips: body.pageTips,
    role: profile.crm_role,
  });

  let reply = turn.reply;
  if (process.env.OPENAI_API_KEY && !turn.refused && !parsed.askedField) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_CRM || 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 220,
        messages: [
          { role: 'system', content: turn.voice.system },
          { role: 'user', content: turn.voice.user },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) {
        reply = stripDisallowedHrefs('crm', text, turn.allowedHrefs) || turn.reply;
      }
    } catch {
      // Catalog fallback already in `reply`.
    }
  }

  return NextResponse.json({
    reply,
    cards: turn.cards,
    refused: turn.refused,
    usedTools: turn.usedTools,
  });
}
