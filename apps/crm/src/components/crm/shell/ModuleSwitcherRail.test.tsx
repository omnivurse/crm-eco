// @vitest-environment jsdom
/**
 * NV-8 (D10) — the drawer grid is the mobile module switcher, so it is the
 * surface that has to answer "where am I?": every module reachable, exactly
 * one `aria-current="page"`, and labels visible when expanded (the phone
 * drawer always renders `expanded`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/inbox',
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
import { ModuleSwitcherRail } from './ModuleSwitcherRail';

function mount(expanded = true) {
  return render(
    <ModuleProvider>
      <ModuleSwitcherRail expanded={expanded} />
    </ModuleProvider>,
  );
}

afterEach(cleanup);

describe('ModuleSwitcherRail (NV-8)', () => {
  it('offers every top module plus Settings', () => {
    const { container } = mount();
    // 6 top modules + Settings — the same set as the desktop tab strip.
    const links = container.querySelectorAll('a[data-crm-module]');
    expect(links).toHaveLength(7);
    expect(
      Array.from(links).map((l) => l.getAttribute('data-crm-module')),
    ).toContain('settings');
  });

  it('marks exactly one grid link aria-current for the URL-resolved module', () => {
    const { container } = mount();
    const current = container.querySelectorAll('a[data-crm-module][aria-current="page"]');
    expect(current).toHaveLength(1);
    // /crm/inbox resolves to Communications.
    expect(current[0].getAttribute('data-crm-module')).toBe('communications');
  });

  it('shows labels when expanded (the mobile drawer never renders icon-only)', () => {
    mount(true);
    expect(screen.getByText('Communications')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('badges Communications with the unread count when expanded', () => {
    render(
      <ModuleProvider>
        <ModuleSwitcherRail expanded inboxUnread={7} />
      </ModuleProvider>,
    );
    expect(screen.getByTestId('crm-comms-unread-badge').textContent).toBe('7');
    expect(screen.queryByTestId('crm-comms-unread-dot')).toBeNull();
    const comms = screen.getByRole('link', { name: /communications/i });
    expect(comms.getAttribute('aria-label')).toBe('Communications, 7 unread conversations');
  });

  it('shows a dot, not a count, on the collapsed Communications tile', () => {
    render(
      <ModuleProvider>
        <ModuleSwitcherRail expanded={false} inboxUnread={7} />
      </ModuleProvider>,
    );
    expect(screen.getByTestId('crm-comms-unread-dot')).toBeTruthy();
    expect(screen.queryByTestId('crm-comms-unread-badge')).toBeNull();
  });
});
