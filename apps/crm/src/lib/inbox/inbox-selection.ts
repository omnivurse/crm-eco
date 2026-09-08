/**
 * Inbox selection vs `?c=` must be one-way: apply the URL only when *the URL
 * changed*. Comparing URL to React state is how the pane got stuck on the
 * first thread — a click updates state immediately, `router.replace` lags,
 * and a mismatch effect re-selected the stale `?c=`.
 */

export function inboxUrlHydrateDecision(opts: {
  conversationFromUrl: string | null | undefined;
  lastSeenUrlId: string | null | undefined;
  selectedId: string | null | undefined;
}): { nextLastSeenUrlId: string | null; apply: boolean } {
  const urlId = opts.conversationFromUrl ?? null;
  if (!urlId) {
    return { nextLastSeenUrlId: null, apply: false };
  }

  const urlChanged = opts.lastSeenUrlId !== urlId;
  if (!urlChanged) {
    return { nextLastSeenUrlId: urlId, apply: false };
  }

  if (opts.selectedId === urlId) {
    return { nextLastSeenUrlId: urlId, apply: false };
  }

  return { nextLastSeenUrlId: urlId, apply: true };
}
