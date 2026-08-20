/**
 * Display-time note dedupe.
 *
 * Two Zoho-import failure modes both look like "the new notes vanished":
 *   1. The same body+timestamp copied onto a lead and a contact (lineage
 *      aggregation). Exact key match.
 *   2. The same imported body stored twice on ONE record with timestamps
 *      ~6 hours apart (local vs UTC double-load). Body fingerprint, legacy
 *      rows only — never collapse two notes a rep actually wrote.
 *
 * Input is assumed newest-first so the first hit is the one we keep.
 */

export type DedupeableNote = {
  body?: string | null;
  created_at: string;
  created_by?: string | null;
};

export function normalizeNoteBodyForDedupe(body: string | null | undefined): string {
  return (body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Cross-record copies: identical payload + timestamp. */
export function exactNoteDedupeKey(note: DedupeableNote): string {
  return `${(note.body || '').trim().slice(0, 200)}|${note.created_at}`;
}

/**
 * Legacy-only body fingerprint. Current CRM notes (`created_by` set) return
 * null so two similar same-day notes a rep wrote both stay visible.
 */
export function legacyBodyDedupeKey(note: DedupeableNote): string | null {
  if (note.created_by) return null;
  const normalized = normalizeNoteBodyForDedupe(note.body);
  if (!normalized) return null;
  return `legacy:${normalized.slice(0, 400)}`;
}

/**
 * Zoho `notes_history` is an HTML dump of notes. Short scalars (plan IDs,
 * member numbers) were written into the same JSONB key and must not render
 * as a notes card or inflate the Notes badge.
 */
export function isLegacyNotesHistoryHtml(raw: string | null | undefined): raw is string {
  const s = (raw || '').trim();
  if (s.length < 40) return false;
  if (/<hr\s*\/?>/i.test(s)) return true;
  if (/<b>[\s\S]{2,80}<\/b>\s*:/i.test(s)) return true;
  if (/<br\s*\/?>/i.test(s) && s.length > 80) return true;
  return false;
}

export function dedupeNotesForDisplay<T extends DedupeableNote>(notes: readonly T[]): T[] {
  const seenExact = new Set<string>();
  const seenLegacyBody = new Set<string>();
  const out: T[] = [];
  for (const note of notes) {
    const exact = exactNoteDedupeKey(note);
    if (seenExact.has(exact)) continue;
    const legacy = legacyBodyDedupeKey(note);
    if (legacy && seenLegacyBody.has(legacy)) continue;
    seenExact.add(exact);
    if (legacy) seenLegacyBody.add(legacy);
    out.push(note);
  }
  return out;
}
