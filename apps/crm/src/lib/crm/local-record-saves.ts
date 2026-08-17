/**
 * local-record-saves — tiny module-level registry of record saves that
 * originated in THIS browser tab.
 *
 * Why: `crm_records` has no `updated_by` / actor column, and the shell's
 * `currentUserId` is the auth uid while `created_by` / `owner_id` hold
 * `profiles.id`, so Realtime UPDATE payloads can never be attributed to
 * the current user by inspecting the row. Without a local signal every
 * save the user makes looks like a teammate edit and triggers a
 * "refreshing" toast + `router.refresh()` that blows away in-progress
 * edits ("every time we do an update the information vanishes").
 *
 * Save paths (`useRecordFieldSave`, `patchCrmRecord`) call
 * `markLocalRecordSaveStarted` / `markLocalRecordSaveFinished`; the live
 * subscription (`useLiveRecord`) asks `matchesLocalUpdatedAt` /
 * `wasRecordSavedLocallyRecently` to flag the event as self-originated.
 *
 * Pure module — no React, no Supabase — safe to import from anywhere.
 */

export const DEFAULT_LOCAL_SAVE_WINDOW_MS = 8_000;

/** Entries older than this are pruned on every write. */
const PRUNE_AFTER_MS = 60_000;

/** Max `updated_at` values remembered per record. */
const MAX_UPDATED_AT_PER_RECORD = 20;

interface LocalSaveEntry {
  /** Number of saves currently in flight for this record. */
  inFlight: number;
  /** Timestamp (ms) of the most recent start or finish. */
  lastActivityAt: number;
  /** Timestamp (ms) of the most recent finished save (0 = none). */
  lastFinishedAt: number;
  /** `updated_at` values the server returned for local saves. */
  updatedAts: string[];
}

const registry = new Map<string, LocalSaveEntry>();

function now(): number {
  return Date.now();
}

function normalizeUpdatedAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  // Normalise to epoch-ms ISO so `2026-08-16T12:00:00+00:00` and
  // `2026-08-16T12:00:00.000Z` compare equal (Postgres vs JSON output).
  const t = Date.parse(value);
  return Number.isNaN(t) ? value : new Date(t).toISOString();
}

function prune(): void {
  const cutoff = now() - PRUNE_AFTER_MS;
  for (const [id, entry] of registry) {
    if (entry.inFlight <= 0 && entry.lastActivityAt < cutoff) {
      registry.delete(id);
    }
  }
}

function getOrCreate(recordId: string): LocalSaveEntry {
  let entry = registry.get(recordId);
  if (!entry) {
    entry = { inFlight: 0, lastActivityAt: now(), lastFinishedAt: 0, updatedAts: [] };
    registry.set(recordId, entry);
  }
  return entry;
}

/** Call immediately before dispatching a PATCH for `recordId`. */
export function markLocalRecordSaveStarted(recordId: string): void {
  if (!recordId) return;
  prune();
  const entry = getOrCreate(recordId);
  entry.inFlight += 1;
  entry.lastActivityAt = now();
}

/**
 * Call when the PATCH settles. Pass the server-returned `updated_at` on
 * success so the matching Realtime UPDATE can be attributed exactly;
 * pass `null`/omit on failure.
 */
export function markLocalRecordSaveFinished(
  recordId: string,
  updatedAt?: string | null,
): void {
  if (!recordId) return;
  const entry = getOrCreate(recordId);
  entry.inFlight = Math.max(0, entry.inFlight - 1);
  const ts = now();
  entry.lastActivityAt = ts;
  entry.lastFinishedAt = ts;
  const normalized = normalizeUpdatedAt(updatedAt);
  if (normalized && !entry.updatedAts.includes(normalized)) {
    entry.updatedAts.push(normalized);
    if (entry.updatedAts.length > MAX_UPDATED_AT_PER_RECORD) {
      entry.updatedAts.splice(0, entry.updatedAts.length - MAX_UPDATED_AT_PER_RECORD);
    }
  }
  prune();
}

/**
 * True when a local save for `recordId` is in flight, or one finished
 * within the last `windowMs`. Note: a genuine teammate edit landing in
 * that same window will also be treated as self — an accepted trade-off
 * versus wiping the user's own edits on every save.
 */
export function wasRecordSavedLocallyRecently(
  recordId: string,
  windowMs: number = DEFAULT_LOCAL_SAVE_WINDOW_MS,
): boolean {
  const entry = registry.get(recordId);
  if (!entry) return false;
  if (entry.inFlight > 0) return true;
  return entry.lastFinishedAt > 0 && now() - entry.lastFinishedAt <= windowMs;
}

/** True when `updatedAt` equals an `updated_at` a local save produced. */
export function matchesLocalUpdatedAt(recordId: string, updatedAt: unknown): boolean {
  const entry = registry.get(recordId);
  if (!entry) return false;
  const normalized = normalizeUpdatedAt(updatedAt);
  if (!normalized) return false;
  return entry.updatedAts.includes(normalized);
}

/** Test-only: wipe the registry. */
export function __resetLocalRecordSavesForTests(): void {
  registry.clear();
}
