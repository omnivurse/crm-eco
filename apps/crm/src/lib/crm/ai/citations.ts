/**
 * Citation validator — drops LLM recommendations that don't cite known evidence.
 */

import type { BriefingAction, BriefingSignal, Citation } from './types';

export function collectCitationIds(signals: BriefingSignal[]): Set<string> {
  const ids = new Set<string>();
  for (const s of signals) {
    for (const e of s.evidence) ids.add(e.id);
  }
  return ids;
}

export function citationIndex(signals: BriefingSignal[]): Map<string, Citation> {
  const map = new Map<string, Citation>();
  for (const s of signals) {
    for (const e of s.evidence) map.set(e.id, e);
  }
  return map;
}

/**
 * Keep only actions whose citationIds are a non-empty subset of known evidence.
 * Returns null when nothing survives (caller should fall back to rules).
 */
export function validateRecommendations(
  actions: BriefingAction[],
  signals: BriefingSignal[],
): BriefingAction[] | null {
  const known = collectCitationIds(signals);
  const cleaned: BriefingAction[] = [];
  for (const a of actions) {
    const ids = (a.citationIds ?? []).filter((id) => known.has(id));
    if (ids.length === 0) continue;
    cleaned.push({ ...a, citationIds: ids });
    if (cleaned.length >= 3) break;
  }
  return cleaned.length > 0 ? cleaned : null;
}
