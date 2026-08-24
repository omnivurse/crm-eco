// @vitest-environment jsdom
/**
 * The hydration contract of useClientAuth, exercised through React itself.
 *
 * WHY THIS EXISTS ALONGSIDE useClientAuth.test.ts. That file pins the store's
 * behaviour directly — it never renders the hook, so it stays green even if the
 * third argument of `useSyncExternalStore` is changed back from
 * `getServerSnapshot` to `getSnapshot`, which is precisely the defect. This
 * file closes that hole: it drives a real server render and a real
 * `hydrateRoot` with a WARM cache, which is the exact condition that used to
 * break, and fails on React's own mismatch report rather than on an assertion
 * about internals.
 *
 * The shape mirrors the real failure on /crm/modules/contacts: a component that
 * branches on `profile` (there, ModuleHeader's create button) inside a tree the
 * server rendered without one, while a globally-mounted instance of the hook
 * had already filled the module cache.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';

// The hook fetches on mount. Neither call may resolve during the test: the
// point is to observe the HYDRATING render, not a post-fetch update.
vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: {
      getUser: () => new Promise(() => {}),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => new Promise(() => {}) }) }),
    }),
  },
}));

import { useClientAuth, clearClientAuthCache, __authStoreInternals, type ClientProfile } from './useClientAuth';

const { setSnapshot } = __authStoreInternals;

const PROFILE: ClientProfile = {
  id: 'p1',
  organization_id: '00000000-0000-0000-0000-000000000001',
  full_name: 'Walk Admin',
  crm_role: 'crm_admin',
  user_id: 'u1',
};

/**
 * Every value this probe rendered, oldest first. The FIRST client entry is the
 * hydrating render — the one that has to agree with the server — and asserting
 * on it directly is what makes this test bite. React 19 reports a mismatch
 * through `onRecoverableError` (also captured below) rather than a plain
 * console.error, and it then silently re-renders the subtree client-side, so
 * the final DOM looks identical whether or not the bug is present. Only the
 * first render's value tells the two apart.
 */
const rendered: Array<ClientProfile | null> = [];

/** Stands in for any control gated on the viewer, e.g. ModuleHeader's create button. */
function CreateButtonProbe() {
  const { profile } = useClientAuth();
  rendered.push(profile);
  return <div id="probe">{profile ? 'CAN CREATE' : 'NO PROFILE'}</div>;
}

describe('useClientAuth hydration', () => {
  let errors: string[];
  let restore: () => void;

  beforeEach(() => {
    clearClientAuthCache();
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    errors = [];
    const originalError = console.error;
    // React reports a hydration mismatch through console.error, so that IS the
    // assertion surface — the same signal the walk's page-error trap grades.
    console.error = (...args: unknown[]) => {
      errors.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    };
    restore = () => {
      console.error = originalError;
    };
  });

  afterEach(() => {
    restore();
    clearClientAuthCache();
  });

  it('the hydrating render sees no profile even when the module cache is warm', async () => {
    // 1. The server renders with nothing known about the viewer.
    const serverHtml = renderToString(<CreateButtonProbe />);
    expect(serverHtml).toContain('NO PROFILE');

    // 2. Meanwhile the globally-mounted instance (ThemeProvider) fills the
    //    cache. This is the condition that made `useState(cachedProfile)`
    //    diverge from the server.
    setSnapshot({ profile: PROFILE, loading: false });

    // 3. Only client renders from here on.
    rendered.length = 0;

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    const recoverable: string[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <CreateButtonProbe />, {
        onRecoverableError: (err: unknown) => {
          recoverable.push(err instanceof Error ? err.message : String(err));
        },
      });
    });

    // THE ASSERTION THAT BITES. The hydrating render must match the server's
    // view — nobody known yet — regardless of what the cache holds.
    expect(
      rendered[0],
      `the hydrating render saw a profile the server never had; React reported: ${recoverable.join(' | ') || '(nothing)'}`,
    ).toBeNull();

    // React must not have had to recover from anything, by its own account.
    const complaints = [...recoverable, ...errors].filter((e) =>
      /hydrat|did not match|server rendered|#418|#422|#423|#425/i.test(e),
    );
    expect(complaints, `React reported a hydration problem:\n${complaints.join('\n')}`).toEqual([]);

    // And the fix must not strand the UI: once hydration commits, React
    // re-reads the live snapshot and the warm profile appears.
    expect(container.querySelector('#probe')?.textContent).toBe('CAN CREATE');

    await act(async () => {
      root?.unmount();
    });
    container.remove();
  });

  it('hydrates without a mismatch when the cache is cold', async () => {
    const serverHtml = renderToString(<CreateButtonProbe />);
    rendered.length = 0;

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    const recoverable: string[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <CreateButtonProbe />, {
        onRecoverableError: (err: unknown) => {
          recoverable.push(err instanceof Error ? err.message : String(err));
        },
      });
    });

    expect(rendered[0]).toBeNull();
    expect([...recoverable, ...errors].filter((e) => /hydrat|did not match|server rendered/i.test(e))).toEqual([]);
    expect(container.querySelector('#probe')?.textContent).toBe('NO PROFILE');

    await act(async () => {
      root?.unmount();
    });
    container.remove();
  });
});
