/**
 * Pure helpers for the ⌘K palette's record results.
 *
 * `/api/crm/search` returns one row per crm_record, so the same person shows
 * up as a Contact, a Lead and a Member — three rows, no relationship. This
 * module folds those into one row per person with a chip per module, decides
 * how many rows to ask for (a phone / member-number query needs a deeper
 * bucket than a name), and tells the palette whether a row has an email at
 * all (the AI email action is pointless without one).
 *
 * No React, no DOM, no server imports — unit-tested in palette-results.test.ts.
 */

import type { RecordSearchMatch } from '@/lib/crm/search-match';

/** Shape of one row from `/api/crm/search` (mirrors the API's SearchResult). */
export interface PaletteSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleKey: string;
  url: string;
  matches?: RecordSearchMatch[];
}

/** One module chip on a grouped row. */
export interface PaletteResultChip {
  /** crm_records id the chip navigates to. */
  id: string;
  /** Short module label for the chip ("Contact", "Lead", "Member"). */
  label: string;
  moduleKey: string;
  url: string;
}

/** A person/record row after grouping. */
export interface PaletteResultGroup {
  /** Stable key for React lists — the primary result id. */
  key: string;
  /** The row that heads the group (first in API rank order). */
  primary: PaletteSearchResult;
  /** All results folded into this row, in rank order (primary first). */
  results: PaletteSearchResult[];
  /** One chip per result — a single chip means "not a duplicate". */
  chips: PaletteResultChip[];
  /** True when 2+ results were folded together. */
  isMerged: boolean;
}

/** Default palette result page. */
export const PALETTE_DEFAULT_LIMIT = 8;
/** Deeper bucket for phone / member-number lookups (all-digit queries). */
export const PALETTE_NUMERIC_LIMIT = 25;

/**
 * True when the query is a phone or member number: only digits once
 * separators are removed, and at least 4 of them.
 */
export function isNumericQuery(query: string): boolean {
  const compact = query.replace(/[\s()+.\-]/g, '');
  return compact.length >= 4 && /^\d+$/.test(compact);
}

/** How many rows to request from `/api/crm/search` for this query. */
export function paletteResultLimit(query: string): number {
  return isNumericQuery(query) ? PALETTE_NUMERIC_LIMIT : PALETTE_DEFAULT_LIMIT;
}

/** Lower-cased, punctuation-free, whitespace-collapsed name key. */
export function normaliseName(title: string | null | undefined): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split the API subtitle ("email · phone · status") into its parts. */
function subtitleParts(r: PaletteSearchResult): string[] {
  return (r.subtitle ?? '')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The result's email, if the API surfaced one (via matches or subtitle). */
export function resultEmail(r: PaletteSearchResult): string | null {
  const fromMatch = r.matches?.find((m) => m.category === 'email')?.value?.trim();
  if (fromMatch && fromMatch.includes('@')) return fromMatch.toLowerCase();
  const fromSubtitle = subtitleParts(r).find((p) => EMAIL_RE.test(p));
  return fromSubtitle ? fromSubtitle.toLowerCase() : null;
}

/** True when we can see an email address on the row. */
export function resultHasEmail(r: PaletteSearchResult): boolean {
  return resultEmail(r) !== null;
}

/** The result's phone as bare digits (last 10 kept so +1 vs none still match). */
export function resultPhoneDigits(r: PaletteSearchResult): string | null {
  const candidates: string[] = [];
  const fromMatch = r.matches?.find((m) => m.category === 'phone')?.value;
  if (fromMatch) candidates.push(fromMatch);
  for (const p of subtitleParts(r)) {
    if (!p.includes('@') && /\d/.test(p)) candidates.push(p);
  }
  for (const c of candidates) {
    const digits = c.replace(/\D/g, '');
    if (digits.length >= 7) return digits.slice(-10);
  }
  return null;
}

/** "Contacts" → "Contact", "Policies" → "Policy", "Members" → "Member". */
export function singularModuleLabel(label: string): string {
  const t = label.trim();
  if (!t) return t;
  if (/ies$/i.test(t)) return t.slice(0, -3) + (t === t.toUpperCase() ? 'Y' : 'y');
  if (/[^s]s$/i.test(t)) return t.slice(0, -1);
  return t;
}

const UNGROUPABLE_TITLES = new Set(['', 'untitled', 'unknown', 'no name']);

/** Generational suffixes that must not masquerade as a surname. */
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/** Normalised name tokens with any trailing generational suffix dropped. */
function nameTokens(title: string | null | undefined): string[] {
  const name = normaliseName(title);
  if (UNGROUPABLE_TITLES.has(name)) return [];
  const tokens = name.split(' ').filter(Boolean);
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens;
}

/**
 * The surname token of a display title: the final normalised token after any
 * generational suffix is dropped ("Mary-Kate O'Brien Jr" → "brien",
 * "John Smith" → "smith"). Returns '' when the title is ungroupable.
 */
export function lastNameToken(title: string | null | undefined): string {
  const tokens = nameTokens(title);
  return tokens.length ? tokens[tokens.length - 1] : '';
}

/**
 * True when two display names plausibly belong to the SAME person, which is
 * the gate for folding on a shared email / phone:
 *   - identical normalised names ("Jane Smith" / "jane smith"), or
 *   - identical surname AND the given name differs only by an initial
 *     ("R. Jones" / "Robert Jones").
 * Different given names on the same surname ("Jane Smith" / "John Smith") are
 * NOT compatible — households share phones and emails, and folding them would
 * hide one person behind the other's name. Ungroupable titles never match.
 */
export function namesCompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta.join(' ') === tb.join(' ')) return true;
  if (ta.length < 2 || tb.length < 2) return false;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false;
  const ga = ta[0];
  const gb = tb[0];
  if (ga === gb) return true;
  if (ga.length === 1 && gb.startsWith(ga)) return true;
  if (gb.length === 1 && ga.startsWith(gb)) return true;
  return false;
}

interface IdentityKeys {
  /** Exact normalised-name key, or null when the title is ungroupable. */
  name: string | null;
  /** Contact keys (email / phone) that only fold when names are compatible. */
  contact: string[];
}

/**
 * Identity keys for a result.
 *
 * A result joins an existing group when:
 *   - its normalised NAME matches (same person, different module), or
 *   - its EMAIL or PHONE matches AND its name is compatible with a member of
 *     that group (see `namesCompatible`). Households share phones and
 *     emails, so a bare phone match is not identity — without the name gate a
 *     phone search would hide "John Smith" (Member) behind "Jane Smith"
 *     (Contact).
 */
function identityKeys(r: PaletteSearchResult): IdentityKeys {
  const name = normaliseName(r.title);
  const contact: string[] = [];
  const email = resultEmail(r);
  if (email) contact.push(`email:${email}`);
  const phone = resultPhoneDigits(r);
  if (phone) contact.push(`phone:${phone}`);
  return {
    name: UNGROUPABLE_TITLES.has(name) ? null : `name:${name}`,
    contact,
  };
}

/**
 * Fold duplicate people into one row each.
 *
 * Rules:
 *  - Results are consumed in API rank order; the first of a group is primary.
 *  - A later result joins a group when it shares a name key, or shares an
 *    email / phone key with a member whose name is compatible — but only if
 *    the group has no member from the SAME module yet. Two Contacts called
 *    "John Smith" stay two rows (they may be two people; the palette must not
 *    hide one). Two household members sharing a phone stay two rows.
 *  - Group order = order of each group's primary result, so ranking is kept.
 */
export function groupPaletteResults(results: PaletteSearchResult[]): PaletteResultGroup[] {
  const groups: Array<{ results: PaletteSearchResult[] }> = [];
  /** key → every group index that carries it (a contact key can span groups). */
  const keyToGroups = new Map<string, number[]>();

  const canJoin = (gi: number, r: PaletteSearchResult, requireNameMatch: boolean): boolean => {
    const g = groups[gi];
    if (g.results.some((m) => m.moduleKey === r.moduleKey)) return false;
    if (!requireNameMatch) return true;
    return g.results.some((m) => namesCompatible(m.title, r.title));
  };

  for (const r of results) {
    const keys = identityKeys(r);
    let target = -1;

    if (keys.name) {
      for (const gi of keyToGroups.get(keys.name) ?? []) {
        if (canJoin(gi, r, false)) {
          target = gi;
          break;
        }
      }
    }
    if (target === -1) {
      outer: for (const k of keys.contact) {
        for (const gi of keyToGroups.get(k) ?? []) {
          if (canJoin(gi, r, true)) {
            target = gi;
            break outer;
          }
        }
      }
    }

    if (target === -1) {
      groups.push({ results: [r] });
      target = groups.length - 1;
    } else {
      groups[target].results.push(r);
    }
    const allKeys = keys.name ? [keys.name, ...keys.contact] : keys.contact;
    for (const k of allKeys) {
      const list = keyToGroups.get(k);
      if (!list) keyToGroups.set(k, [target]);
      else if (!list.includes(target)) list.push(target);
    }
  }

  return groups.map((g) => {
    const primary = g.results[0];
    return {
      key: primary.id,
      primary,
      results: g.results,
      chips: g.results.map((m) => ({
        id: m.id,
        label: singularModuleLabel(m.module || m.moduleKey),
        moduleKey: m.moduleKey,
        url: m.url,
      })),
      isMerged: g.results.length > 1,
    };
  });
}
