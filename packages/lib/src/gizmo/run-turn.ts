import { hrefAllowed, sanitizeRecordHits } from './href-guard';
import {
  looksLikeHowtoQuery,
  looksLikePlaceQuery,
  looksLikeRecordQuery,
  rankHowto,
  rankPlaces,
} from './match';
import { detectForeignAsk } from './refuse';
import type {
  GizmoCard,
  GizmoHowto,
  GizmoPlace,
  GizmoToolName,
  GizmoTurnResult,
  RunGizmoTurnInput,
} from './types';

const COMPANION_VOICE = `You are Gizmo, a trusted companion for THIS app only.
Answer where / who / how. Be brief and concrete.
Cite ONLY hrefs listed under Allowed links. Never invent a URL or record path.
If tools found nothing, say so and offer a narrower search.
If the user asks about another app, say: That's not in this workspace.`;

function cardsFromPlaces(places: GizmoPlace[]): GizmoCard[] {
  return places.map((p) => ({
    kind: 'place' as const,
    title: p.title,
    subtitle: p.group,
    href: p.href,
  }));
}

function cardsFromHowto(items: GizmoHowto[]): GizmoCard[] {
  return items.map((h) => ({
    kind: 'howto' as const,
    title: h.title,
    href: h.href,
    steps: h.steps,
  }));
}

function scopedPlaces(input: RunGizmoTurnInput): GizmoPlace[] {
  return input.places.filter((p) => hrefAllowed(input.app, p.href));
}

function scopedHowto(input: RunGizmoTurnInput): GizmoHowto[] {
  return input.howto.filter((h) => hrefAllowed(input.app, h.href));
}

function buildVoice(
  input: RunGizmoTurnInput,
  cards: GizmoCard[],
  reply: string,
): { system: string; user: string } {
  const allowed = cards.map((c) => c.href).filter((h) => hrefAllowed(input.app, h));
  const system = [
    COMPANION_VOICE,
    `app_id=${input.app}`,
    input.role ? `role=${input.role}` : '',
    `Allowed links:\n${allowed.length ? allowed.map((h) => `- ${h}`).join('\n') : '(none)'}`,
  ]
    .filter(Boolean)
    .join('\n');
  const user = [
    `User: ${input.query}`,
    input.pathname ? `Current page: ${input.pathname}` : '',
    `Deterministic reply to paraphrase (keep facts, do not add links):\n${reply}`,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export function runGizmoTurn(input: RunGizmoTurnInput): GizmoTurnResult {
  const usedTools: GizmoToolName[] = [];
  const foreign = detectForeignAsk(input.app, input.query);
  if (foreign) {
    const voice = buildVoice(input, [], foreign.message);
    return {
      reply: foreign.message,
      cards: [],
      refused: true,
      usedTools,
      allowedHrefs: [],
      voice,
    };
  }

  if (/\bwhat(?:'s| is) this page\b/i.test(input.query) && input.pageTips?.length) {
    const reply = input.pageTips.map((t) => `${t.title}: ${t.body}`).join('\n');
    const voice = buildVoice(input, [], reply);
    return {
      reply,
      cards: [],
      refused: false,
      usedTools: ['page_context'],
      allowedHrefs: [],
      voice,
    };
  }

  const places = scopedPlaces(input);
  const howto = scopedHowto(input);
  const records = looksLikeRecordQuery(input.query)
    ? sanitizeRecordHits(input.app, input.records ?? [])
    : [];

  const placeHits = rankPlaces(places, input.query);
  const howtoHits = rankHowto(howto, input.query);

  if (records.length) usedTools.push('search_records');
  if (placeHits.length) usedTools.push('find_place');
  if (howtoHits.length) usedTools.push('find_howto');
  if (input.pageTips?.length || input.pathname) usedTools.push('page_context');

  const cards: GizmoCard[] = [];
  for (const r of records) {
    cards.push({
      kind: 'record',
      title: r.title,
      subtitle: r.subtitle,
      href: r.href,
      module: r.module,
    });
  }
  const preferHowto = looksLikeHowtoQuery(input.query) && howtoHits.length > 0;
  const preferPlace = looksLikePlaceQuery(input.query) && placeHits.length > 0;

  if (preferHowto) {
    cards.push(...cardsFromHowto(howtoHits));
    if (placeHits.length && cards.length < 6) cards.push(...cardsFromPlaces(placeHits.slice(0, 2)));
  } else if (preferPlace) {
    cards.push(...cardsFromPlaces(placeHits));
    if (howtoHits.length && cards.length < 6) cards.push(...cardsFromHowto(howtoHits.slice(0, 1)));
  } else {
    if (placeHits.length) cards.push(...cardsFromPlaces(placeHits));
    if (howtoHits.length && cards.length < 6) cards.push(...cardsFromHowto(howtoHits));
  }

  const unique: GizmoCard[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const key = `${c.kind}:${c.href}:${c.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  const allowedHrefs = unique.map((c) => c.href);
  let reply: string;
  if (unique.length === 0) {
    reply =
      "I couldn't find that in this workspace. Try a name, a page title, or a shorter how-to.";
  } else if (records.length) {
    reply = `Found ${records.length} record${records.length === 1 ? '' : 's'}. Open a card to go there.`;
  } else if (unique[0]?.kind === 'howto') {
    reply = `${unique[0].title}. ${unique[0].steps?.join(' ') ?? ''}`.trim();
  } else {
    reply = `${unique[0].title} is here.`;
  }

  const voice = buildVoice(input, unique, reply);
  return {
    reply,
    cards: unique,
    refused: false,
    usedTools,
    allowedHrefs,
    voice,
  };
}
