/**
 * Why value-equality on the Gizmo persisted state is load-bearing.
 *
 * GizmoProvider wraps `children` in CrmShell, so it sits ABOVE the page-level
 * <Suspense> boundaries. React discards a boundary's server HTML when an
 * ancestor context changes while that boundary is still dehydrated. The mount
 * effect that restores localStorage used to merge unconditionally
 * (`setPersisted((prev) => ({ ...prev, ...parsed }))`), minting a NEW object
 * even when the stored value matched what was already held — so every returning
 * viewer with a `gizmo_state*` key paid one context change on mount and could
 * watch the CRM page body blank and repaint.
 *
 * `samePersistedState` is what lets that effect keep the object it has.
 */
import { describe, expect, it } from 'vitest';

import { samePersistedState } from './GizmoProvider';
import type { GizmoPersistedState } from './gizmo-types';

const base: GizmoPersistedState = {
  enabled: true,
  dismissedTipIds: ['tip-a', 'tip-b'],
  welcomeCompleted: false,
};

describe('samePersistedState', () => {
  it('treats a distinct but equal object as unchanged — the whole point', () => {
    // This is exactly what JSON.parse(localStorage) hands back on every load.
    const fromStorage: GizmoPersistedState = {
      enabled: true,
      dismissedTipIds: ['tip-a', 'tip-b'],
      welcomeCompleted: false,
    };
    expect(fromStorage).not.toBe(base);
    expect(samePersistedState(base, fromStorage)).toBe(true);
  });

  it('is identity-safe', () => {
    expect(samePersistedState(base, base)).toBe(true);
  });

  it('notices a changed flag', () => {
    expect(samePersistedState(base, { ...base, enabled: false })).toBe(false);
    expect(samePersistedState(base, { ...base, welcomeCompleted: true })).toBe(false);
  });

  it('notices an added, removed or different dismissed tip', () => {
    expect(samePersistedState(base, { ...base, dismissedTipIds: ['tip-a'] })).toBe(false);
    expect(samePersistedState(base, { ...base, dismissedTipIds: ['tip-a', 'tip-b', 'tip-c'] })).toBe(false);
    expect(samePersistedState(base, { ...base, dismissedTipIds: ['tip-a', 'tip-c'] })).toBe(false);
  });

  it('does not treat a reordered list as equal', () => {
    // dismissTip only ever appends, so order is stable in practice; a
    // positional compare must still not claim two different orders are equal.
    expect(samePersistedState(base, { ...base, dismissedTipIds: ['tip-b', 'tip-a'] })).toBe(false);
  });

  it('handles the empty list', () => {
    const empty: GizmoPersistedState = { enabled: true, dismissedTipIds: [], welcomeCompleted: false };
    expect(samePersistedState(empty, { ...empty, dismissedTipIds: [] })).toBe(true);
    expect(samePersistedState(empty, base)).toBe(false);
  });
});
