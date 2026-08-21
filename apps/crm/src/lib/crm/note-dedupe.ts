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
 *
 * This is a body fingerprint ONLY — it deliberately carries no timestamp,
 * because the caller decides how far apart two matching bodies may be. See
 * {@link LEGACY_TWIN_WINDOW_MS}: collapsing on body alone treats a follow-up
 * call months later as a duplicate of the first one and hides real history.
 */
export function legacyBodyDedupeKey(note: DedupeableNote): string | null {
  if (note.created_by) return null;
  const normalized = normalizeNoteBodyForDedupe(note.body);
  if (!normalized) return null;
  return `legacy:${normalized.slice(0, 400)}`;
}

/**
 * How far apart two identical legacy bodies may sit and still be treated as
 * the SAME note double-loaded (local vs UTC), rather than as two genuine
 * outreach attempts.
 *
 * Reps legitimately re-send the same templated line — "Left a detailed
 * message on voicemail" — weeks or months apart. Ignoring the gap collapsed
 * those into one, which reads to the user as history going missing: exactly
 * the complaint this module exists to fix. 12h comfortably covers the
 * timezone twin without reaching a later attempt.
 */
export const LEGACY_TWIN_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Is there imported history here worth rendering at all?
 *
 * Zoho wrote both note dumps AND short scalars (plan ids, member numbers)
 * into the same JSONB key; only the scalars should be suppressed. Length is
 * the test, NOT markup — a great many imported histories are plain text
 * ("11-6-15 He's in CA 'til Mon. 12-3-15 Completed his enrollment today…"),
 * and gating on HTML markers hid every one of them.
 */
export function hasLegacyNotesHistory(raw: string | null | undefined): raw is string {
  return (raw || '').trim().length >= 40;
}

/**
 * Does the imported history carry Zoho's HTML markup, so it should be parsed
 * as HTML rather than rendered as pre-formatted text? This chooses the
 * RENDERING MODE — it must never decide whether history is shown at all.
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
  // Timestamps of the legacy notes we KEPT, per body fingerprint. A repeat
  // body only collapses when it sits within LEGACY_TWIN_WINDOW_MS of one we
  // already kept — the double-load twin — so the same templated line sent
  // again weeks later still shows as its own outreach.
  const keptLegacyTimes = new Map<string, number[]>();
  const out: T[] = [];

  for (const note of notes) {
    const exact = exactNoteDedupeKey(note);
    if (seenExact.has(exact)) continue;

    const legacy = legacyBodyDedupeKey(note);
    const at = legacy ? Date.parse(note.created_at) : Number.NaN;

    if (legacy && Number.isFinite(at)) {
      const kept = keptLegacyTimes.get(legacy);
      if (kept?.some((t) => Math.abs(t - at) <= LEGACY_TWIN_WINDOW_MS)) continue;
    }

    seenExact.add(exact);
    if (legacy && Number.isFinite(at)) {
      const kept = keptLegacyTimes.get(legacy);
      if (kept) kept.push(at);
      else keptLegacyTimes.set(legacy, [at]);
    }
    out.push(note);
  }
  return out;
}
