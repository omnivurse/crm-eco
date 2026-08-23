// @vitest-environment jsdom
/**
 * Road to Ten FB-M1 — the CRM toaster follows the CRM theme. ClientProviders
 * reads `resolvedTheme` from the ThemeProvider (mounted above it in the root
 * layout) and hands it to the shared Toaster, which forwards it to sonner so a
 * dark console gets a dark toast (sonner paints `data-sonner-theme="dark"`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/crm',
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('@/components/auth/SessionLock', () => ({ SessionLock: () => null }));

const themeState = { resolvedTheme: 'light' as 'light' | 'dark' };
vi.mock('@/components/providers/theme-provider', () => ({
  useTheme: () => ({
    theme: themeState.resolvedTheme,
    resolvedTheme: themeState.resolvedTheme,
    setTheme: vi.fn(),
    isLoading: false,
  }),
}));

// The CRM's sonner re-export is replaced by a probe so the assertion is about
// what ClientProviders passes, not about sonner's DOM.
vi.mock('@/components/ui/sonner', () => ({
  Toaster: ({ theme }: { theme?: string }) => (
    <div data-testid="toaster-probe" data-theme={theme ?? 'unset'} />
  ),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { ClientProviders } from './ClientProviders';
import { Toaster as SharedToaster, toast as sharedToast } from '@crm-eco/ui/components/sonner';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  themeState.resolvedTheme = 'light';
});

describe('ClientProviders → Toaster theme (FB-M1)', () => {
  // SecurityProvider flips a mounted flag in a microtask; awaiting act() keeps
  // the render free of act() warnings.
  async function mount(ui: React.ReactElement) {
    await act(async () => {
      render(ui);
    });
  }

  it('passes the resolved CRM theme to the Toaster', async () => {
    themeState.resolvedTheme = 'dark';
    await mount(
      <ClientProviders>
        <span>child</span>
      </ClientProviders>,
    );
    expect(screen.getByText('child')).toBeTruthy();
    expect(screen.getByTestId('toaster-probe').getAttribute('data-theme')).toBe('dark');
  });

  it('stays light when the console is light (and still mounts under a tenant)', async () => {
    themeState.resolvedTheme = 'light';
    await mount(
      <ClientProviders organizationId="00000000-0000-0000-0000-000000000001">
        <span>child</span>
      </ClientProviders>,
    );
    expect(screen.getByTestId('toaster-probe').getAttribute('data-theme')).toBe('light');
  });
});

describe('@crm-eco/ui Toaster forwards theme to sonner', () => {
  async function renderAndToast(theme?: 'light' | 'dark') {
    render(<SharedToaster theme={theme} />);
    await act(async () => {
      sharedToast('probe toast');
    });
    await screen.findByText('probe toast');
    const list = document.querySelector('[data-sonner-toaster]');
    return list?.getAttribute('data-sonner-theme') ?? null;
  }

  it('paints dark toasts when theme="dark"', async () => {
    expect(await renderAndToast('dark')).toBe('dark');
  });

  it('keeps sonner\'s light default when no theme is passed (other apps unchanged)', async () => {
    expect(await renderAndToast(undefined)).toBe('light');
  });
});
