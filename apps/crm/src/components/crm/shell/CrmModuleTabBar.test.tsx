// @vitest-environment jsdom
/**
 * NV-8 (D10) — one module switcher on mobile.
 *
 * The 7-tab strip (6 top modules + Settings) is desktop chrome: below `lg` the phone's
 * switcher is the grid inside the nav drawer, so the strip must be hidden
 * rather than rendered a second time above a 390px viewport. The strip still
 * marks exactly one tab `aria-current` so the desktop assertion in walk-nav
 * (NV-inventory) keeps its meaning.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/commissions',
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...rest
  }: {
    children?: React.ReactNode;
    href: string;
    prefetch?: boolean;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ModuleProvider } from '@/contexts/ModuleContext';
import { CrmModuleTabBar } from './CrmModuleTabBar';

function mount(navProfile: 'full' | 'simple' = 'full') {
  return render(
    <ModuleProvider>
      <CrmModuleTabBar navProfile={navProfile} />
    </ModuleProvider>,
  );
}

afterEach(cleanup);

describe('CrmModuleTabBar (NV-8)', () => {
  it('hides the strip below lg and shows it from lg up', () => {
    mount();
    const strip = screen.getByTestId('crm-module-tabbar');
    const classes = strip.className.split(/\s+/);
    expect(classes).toContain('hidden');
    expect(classes).toContain('lg:block');
    // A bare `lg:hidden`-style inversion would leave the strip on phones.
    expect(classes).not.toContain('block');
  });

  it('still marks exactly one tab aria-current for the URL-resolved module', () => {
    mount();
    // 6 top modules + Settings.
    const tabs = screen.getAllByTestId('crm-module-tab');
    expect(tabs).toHaveLength(7);
    const current = tabs.filter((t) => t.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    // /crm/commissions resolves to the Revenue tab.
    expect(current[0].getAttribute('data-crm-module')).toBe('revenue');
  });

  it('renders nothing at all under the simple nav profile', () => {
    mount('simple');
    expect(screen.queryByTestId('crm-module-tabbar')).toBeNull();
  });
});
