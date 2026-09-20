import type { GizmoHowto, GizmoPlace } from './types';

const BASIC_STOP = new Set(['the', 'a', 'an', 'my', 'to']);

/** Filler + field words that must not score settings pages on person asks. */
const PLACE_SCORE_STOP = new Set([
  ...BASIC_STOP,
  'i',
  'im',
  'need',
  'please',
  'can',
  'you',
  'me',
  'get',
  'give',
  'show',
  'tell',
  'what',
  'whats',
  'for',
  'of',
  'and',
  'or',
  'his',
  'her',
  'their',
  'is',
  'do',
  'how',
  'where',
  'this',
  'page',
  'phone',
  'telephone',
  'mobile',
  'cell',
  'email',
  'mail',
  'address',
  'number',
  'numbers',
]);

export function normalizeQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/['’]s\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s#+./-]+/gu, ' ')
    .replace(/\s+/g, ' ');
}

export function tokenize(q: string): string[] {
  return normalizeQuery(q)
    .split(' ')
    .filter((t) => t.length > 1 && !BASIC_STOP.has(t));
}

function tokenizeForPlace(q: string): string[] {
  return normalizeQuery(q)
    .split(' ')
    .filter((t) => t.length >= 3 && !PLACE_SCORE_STOP.has(t));
}

function scoreHaystack(hay: string, tokens: string[], raw: string): number {
  const h = hay.toLowerCase();
  if (!h) return 0;
  if (h === raw) return 100;
  if (h.startsWith(raw)) return 80;
  if (h.includes(raw) && raw.length >= 2) return 60;
  let score = 0;
  let hits = 0;
  for (const t of tokens) {
    if (h === t) {
      score += 40;
      hits += 1;
    } else if (h.startsWith(t)) {
      score += 28;
      hits += 1;
    } else if (h.includes(t)) {
      score += 16;
      hits += 1;
    }
  }
  if (tokens.length > 1 && hits === tokens.length) score += 12;
  return score;
}

export function scorePlace(place: GizmoPlace, query: string): number {
  const raw = normalizeQuery(query);
  if (!raw) return 0;
  const tokens = tokenizeForPlace(query);
  let best = scoreHaystack(place.title, tokens, raw);
  for (const alias of place.aliases) {
    best = Math.max(best, scoreHaystack(alias, tokens, raw));
  }
  if (place.group) best = Math.max(best, scoreHaystack(place.group, tokens, raw) * 0.5);
  return best;
}

export function scoreHowto(item: GizmoHowto, query: string): number {
  const raw = normalizeQuery(query);
  if (!raw) return 0;
  const tokens = tokenizeForPlace(query);
  let best = scoreHaystack(item.title, tokens, raw);
  for (const alias of item.aliases) {
    best = Math.max(best, scoreHaystack(alias, tokens, raw));
  }
  return best;
}

export function rankPlaces(places: GizmoPlace[], query: string, limit = 5): GizmoPlace[] {
  return places
    .map((p) => ({ p, s: scorePlace(p, query) }))
    .filter((x) => x.s >= 16)
    .sort((a, b) => b.s - a.s || a.p.title.localeCompare(b.p.title))
    .slice(0, limit)
    .map((x) => x.p);
}

export function rankHowto(items: GizmoHowto[], query: string, limit = 4): GizmoHowto[] {
  return items
    .map((p) => ({ p, s: scoreHowto(p, query) }))
    .filter((x) => x.s >= 16)
    .sort((a, b) => b.s - a.s || a.p.title.localeCompare(b.p.title))
    .slice(0, limit)
    .map((x) => x.p);
}

export function looksLikeHowtoQuery(query: string): boolean {
  return /\b(how (do|to|can)|steps?|guide|tutorial|learn|import|set up|setup)\b/i.test(query);
}

export function looksLikePlaceQuery(query: string): boolean {
  return /\b(where is|where's|take me|go to|open settings|find the|page for)\b/i.test(query);
}
