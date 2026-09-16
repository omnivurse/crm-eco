import type { GizmoHowto, GizmoPlace } from './types';

export function normalizeQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#+./-]+/gu, ' ')
    .replace(/\s+/g, ' ');
}

export function tokenize(q: string): string[] {
  return normalizeQuery(q)
    .split(' ')
    .filter((t) => t.length > 0 && t !== 'the' && t !== 'a' && t !== 'an' && t !== 'my' && t !== 'to');
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
  const tokens = tokenize(query);
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
  const tokens = tokenize(query);
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

const FIND_HINT = /\b(find|search|open|lookup|look up|who is)\b/i;
const PHONE_HINT = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/;
const MEMBER_NUM = /(?:#|member(?:ship)?\s*(?:#|number|no\.?)?\s*)\d{3,}/i;
const UUID_HINT = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const PAGE_WORDS = new Set([
  'reports',
  'report',
  'settings',
  'import',
  'inbox',
  'workqueue',
  'dashboard',
  'contacts',
  'leads',
  'deals',
  'members',
  'calendar',
  'tasks',
  'mfa',
  '2fa',
  'security',
  'billing',
  'commissions',
  'coverage',
  'needs',
  'pipeline',
  'home',
  'learn',
  'help',
  'rates',
]);

function remainderAfterIntent(query: string): string {
  return query
    .replace(
      /^(where'?s|where is|take me to|go to|find the|page for|how do i|how to|how can i|find|search for|search|open|look up|lookup|who is)\s+/i,
      '',
    )
    .trim();
}

function isNameish(query: string): boolean {
  const tokens = tokenize(query).filter(
    (t) => !['find', 'search', 'open', 'where', 'is', 'who', 'how', 'do'].includes(t),
  );
  if (tokens.length >= 2 && tokens.every((t) => /^[a-z][a-z'-]{1,}$/i.test(t))) return true;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(query.trim())) return true;
  return false;
}

export function looksLikeRecordQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (PHONE_HINT.test(q) || MEMBER_NUM.test(q) || UUID_HINT.test(q)) return true;

  const rest = remainderAfterIntent(q);
  const restNorm = normalizeQuery(rest);
  const restIsPage = restNorm.split(' ').every((t) => PAGE_WORDS.has(t));

  if (looksLikePlaceQuery(q) || looksLikeHowtoQuery(q)) {
    return Boolean(rest) && isNameish(rest) && !restIsPage;
  }
  if (FIND_HINT.test(q) && q.split(/\s+/).length >= 2) {
    if (!restNorm || restIsPage) return false;
    return isNameish(rest) || !PAGE_WORDS.has(restNorm);
  }
  return isNameish(q);
}

export function looksLikeHowtoQuery(query: string): boolean {
  return /\b(how (do|to|can)|steps?|guide|tutorial|learn|import|set up|setup)\b/i.test(query);
}

export function looksLikePlaceQuery(query: string): boolean {
  return /\b(where is|where's|take me|go to|open settings|find the|page for)\b/i.test(query);
}
