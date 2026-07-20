/**
 * Client-side habit beacon helpers (0 tokens).
 * Fire-and-forget; never throw to callers.
 */

import type { HabitSignalType } from './types';

const lastSent = new Map<string, number>();

function dedupeKey(type: string, parts: Array<string | null | undefined>): string {
  return `${type}:${parts.filter(Boolean).join(':')}`;
}

export function emitHabitSignal(
  signal_type: HabitSignalType,
  opts?: {
    module_key?: string | null;
    entity_id?: string | null;
    meta?: Record<string, unknown>;
    /** Minimum ms between identical signals (default 30s). */
    dedupeMs?: number;
  },
): void {
  if (typeof window === 'undefined') return;

  const dedupeMs = opts?.dedupeMs ?? 30_000;
  const key = dedupeKey(signal_type, [
    opts?.module_key,
    opts?.entity_id,
    typeof opts?.meta?.view_id === 'string' ? opts.meta.view_id : null,
    typeof opts?.meta?.q_hash === 'string' ? opts.meta.q_hash : null,
    typeof opts?.meta?.channel === 'string' ? opts.meta.channel : null,
  ]);
  const now = Date.now();
  const last = lastSent.get(key) ?? 0;
  if (now - last < dedupeMs) return;
  lastSent.set(key, now);

  void fetch('/api/crm/signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      signal_type,
      module_key: opts?.module_key ?? null,
      entity_id: opts?.entity_id ?? null,
      meta: opts?.meta ?? {},
    }),
    keepalive: true,
  }).catch(() => {
    lastSent.delete(key);
  });
}

/** Extract module key from CRM paths like /crm/modules/leads or /crm/r/... */
export function moduleKeyFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const mod = pathname.match(/^\/crm\/modules\/([^/?#]+)/);
  if (mod?.[1]) return mod[1];
  return null;
}

export async function hashSearchQuery(q: string): Promise<string> {
  const normalized = q.toLowerCase().trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }
  // Fallback (non-crypto) — still avoid sending raw query
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = (h * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `f${h.toString(16)}`;
}
