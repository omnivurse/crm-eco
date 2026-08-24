/**
 * The hydration contract of the client-auth store.
 *
 * The defect this pins: the hook used to seed component state from a
 * module-level cache (`useState(cachedProfile)`). One instance is mounted
 * globally (ThemeProvider), so that cache is normally WARM by the time a
 * component inside a streamed <Suspense> boundary hydrates — and the hydrating
 * render then had a profile the server render never had. On
 * /crm/modules/contacts that flipped ModuleHeader's create button on, React saw
 * two different trees and threw the list subtree away: "Hydration failed…" in
 * dev, minified error #418 in production.
 *
 * The invariant that makes it impossible: `getServerSnapshot` — which React
 * uses for the server render AND for the hydrating client render — must return
 * the same empty snapshot no matter what the cache holds.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { __authStoreInternals, clearClientAuthCache, type ClientProfile } from './useClientAuth';

const { getSnapshot, getServerSnapshot, setSnapshot, subscribe, EMPTY_SNAPSHOT } = __authStoreInternals;

const PROFILE: ClientProfile = {
  id: 'p1',
  organization_id: '00000000-0000-0000-0000-000000000001',
  full_name: 'Walk Admin',
  crm_role: 'crm_admin',
  user_id: 'u1',
};

describe('client-auth store', () => {
  beforeEach(() => {
    clearClientAuthCache();
  });

  it('serves the SAME empty snapshot to hydration even when the cache is warm', () => {
    setSnapshot({ profile: PROFILE, loading: false });
    expect(getSnapshot().profile).toBe(PROFILE);
    // The hydrating render must not see it — this is the whole fix.
    expect(getServerSnapshot()).toBe(EMPTY_SNAPSHOT);
    expect(getServerSnapshot().profile).toBeNull();
    expect(getServerSnapshot().loading).toBe(true);
  });

  it('keeps the server snapshot referentially stable across calls', () => {
    // useSyncExternalStore compares by reference; a fresh object each call is an
    // infinite render loop.
    expect(getServerSnapshot()).toBe(getServerSnapshot());
  });

  it('returns a stable snapshot reference when nothing actually changed', () => {
    setSnapshot({ profile: PROFILE, loading: false });
    const first = getSnapshot();
    setSnapshot({ profile: PROFILE, loading: false });
    expect(getSnapshot()).toBe(first);
  });

  it('notifies subscribers on a real change and not on a no-op', () => {
    let calls = 0;
    const unsubscribe = subscribe(() => {
      calls += 1;
    });
    setSnapshot({ loading: false });
    expect(calls).toBe(1);
    setSnapshot({ loading: false });
    expect(calls).toBe(1);
    setSnapshot({ profile: PROFILE });
    expect(calls).toBe(2);
    unsubscribe();
    setSnapshot({ profile: null });
    expect(calls).toBe(2);
  });

  it('clearClientAuthCache returns the store to the hydration snapshot', () => {
    setSnapshot({ user: { id: 'u1' } as never, profile: PROFILE, loading: false });
    clearClientAuthCache();
    expect(getSnapshot()).toBe(EMPTY_SNAPSHOT);
  });
});
