'use client';

import { useEffect, useRef } from 'react';

/**
 * Keeps long-lived search overlays ephemeral.
 *
 * Shell-mounted UIs (⌘K Command Palette, global search dialogs) survive route
 * changes. If their query is only cleared on some close paths (result click /
 * Escape) but not overlay click or shortcut toggle, the previous person's name
 * remains and blocks the next search.
 *
 * **Contract:** whenever `open` is false, `reset` runs. Callers must wipe
 * query, results, selection, loading, and abort in-flight fetches inside
 * `reset`.
 *
 * Prefer this over ad-hoc `setQuery('')` scattered across close handlers —
 * those paths drift and regress.
 */
export function useEphemeralSearchWhenClosed(open: boolean, reset: () => void): void {
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    if (open) return;
    resetRef.current();
  }, [open]);
}

/**
 * Pure policy helper — used by unit tests and any non-React caller that needs
 * the same close→clear rule without mounting a hook.
 */
export function shouldClearEphemeralSearchOnOpenChange(nextOpen: boolean): boolean {
  return nextOpen === false;
}
