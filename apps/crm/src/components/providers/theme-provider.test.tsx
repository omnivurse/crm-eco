// @vitest-environment jsdom
/**
 * PI-1 — the invariant the whole fix rests on.
 *
 * `ThemeProvider` sits ABOVE the `<Suspense>` boundary in `app/crm/layout.tsx`.
 * While that boundary is still dehydrated, React walks up looking for a context
 * provider whose value changed; if it finds one it discards the server HTML and
 * client-renders the subtree, which is what made every `useId()` in the CRM
 * shell disagree with the id the server had already written into
 * `id` / `aria-controls`.
 *
 * So the assertion here is not "the theme works" — it is "the context value is
 * the SAME object before and after the provider's mount effects run". That is
 * the property that regressed before and the one a future edit could silently
 * break by going back to `value={{ theme, resolvedTheme, ... }}`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useContext } from 'react';

const updateMock = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }),
      update: (...args: unknown[]) => {
        updateMock(...args);
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
}));

const auth = { profile: null as { user_id: string } | null, user: null };
vi.mock('@/hooks/useClientAuth', () => ({ useClientAuth: () => auth }));

import { ThemeProvider, ThemeProviderContext, useTheme } from './theme-provider';
import { THEME_STORAGE_KEY } from '@crm-eco/ui/lib/theme-boot';

function ThemeProbe() {
  const { theme, resolvedTheme, isLoading, setTheme } = useTheme();
  return (
    <button
      type="button"
      data-testid="probe"
      data-theme={theme}
      data-resolved={resolvedTheme}
      data-loading={String(isLoading)}
      onClick={() => void setTheme('dark')}
    />
  );
}

// Node >=22 pre-declares a `localStorage` global that shadows jsdom's — install
// a real in-memory Storage per test (same recipe as PipelineFilterWorkspace).
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage;
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true, writable: true });
  // jsdom has no matchMedia; the provider asks it to resolve `system`.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
  document.documentElement.classList.remove('light', 'dark');
  auth.profile = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function mount(ui: React.ReactElement) {
  await act(async () => {
    render(ui);
  });
}

describe('ThemeProvider (PI-1: stable context value)', () => {
  it('never changes the value on its context — not on mount, not on a theme switch', async () => {
    // This is the assertion the CRM shell's server HTML depends on. React
    // compares CONTEXT VALUE IDENTITY when it decides whether a dehydrated
    // <Suspense> below can keep its server markup, so the thing under test is
    // the object, not the theme it carries.
    const captured: unknown[] = [];
    function Capture() {
      captured.push(useContext(ThemeProviderContext));
      return null;
    }

    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    await mount(
      <ThemeProvider>
        <Capture />
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0]).toBeDefined();

    await act(async () => {
      screen.getByTestId('probe').click();
    });

    // The switch really happened, and the subscribed consumer saw it…
    expect(screen.getByTestId('probe').getAttribute('data-theme')).toBe('dark');
    // …while the plain context consumer was never re-rendered even once, which
    // is only possible if the value React holds on this context is untouched.
    // (Against the pre-fix provider — `value={useMemo(() => ({theme, …}))}` —
    // this consumer re-renders on every mount effect and on the switch, and
    // `captured` fills with DISTINCT objects.)
    expect(captured.length).toBe(1);
    expect(new Set(captured).size).toBe(1);
  });

  it('resolves a stored theme, paints the class and clears isLoading', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    await mount(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('data-theme')).toBe('dark');
    expect(probe.getAttribute('data-resolved')).toBe('dark');
    expect(probe.getAttribute('data-loading')).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists a switch to localStorage and to the profile row', async () => {
    auth.profile = { user_id: 'user-1' };

    await mount(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await act(async () => {
      screen.getByTestId('probe').click();
    });

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByTestId('probe').getAttribute('data-theme')).toBe('dark');
    expect(updateMock).toHaveBeenCalledWith({ ui_theme: 'dark' });
  });

  it('throws a useful error outside a provider', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeProbe />)).toThrow(/must be used within a ThemeProvider/);
    quiet.mockRestore();
  });
});
