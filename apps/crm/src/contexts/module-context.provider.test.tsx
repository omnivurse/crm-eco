// @vitest-environment jsdom
/**
 * NV-2 — the ModuleProvider wiring: the tab is resolved from the URL on the
 * first render (no flash; the provider no longer reads the old
 * `crm_active_module` localStorage key, so nothing stored can override a deep
 * link) and stays put across a cross-tab sidebar hop.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

const nav = { pathname: '/crm', search: '' };
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { ModulePathSync, ModuleProvider, useModule } from './ModuleContext';

function Probe() {
  const { activeModule } = useModule();
  return <span data-testid="tab">{activeModule}</span>;
}

function mount() {
  return render(
    <ModuleProvider>
      <ModulePathSync />
      <Probe />
    </ModuleProvider>,
  );
}

afterEach(() => {
  cleanup();
  nav.pathname = '/crm';
  nav.search = '';
});

describe('ModuleProvider + ModulePathSync', () => {
  it('a deep link paints its own tab on the first render', () => {
    nav.pathname = '/crm/settings/fields';
    mount();
    expect(screen.getByTestId('tab').textContent).toBe('settings');
  });

  it('CRM › Inbox keeps the CRM tab; a non-listed page follows the URL', async () => {
    const view = mount();
    expect(screen.getByTestId('tab').textContent).toBe('crm');

    nav.pathname = '/crm/inbox';
    await act(async () => {
      view.rerender(
        <ModuleProvider>
          <ModulePathSync />
          <Probe />
        </ModuleProvider>,
      );
    });
    expect(screen.getByTestId('tab').textContent).toBe('crm');

    nav.pathname = '/crm/communications/compose';
    await act(async () => {
      view.rerender(
        <ModuleProvider>
          <ModulePathSync />
          <Probe />
        </ModuleProvider>,
      );
    });
    expect(screen.getByTestId('tab').textContent).toBe('communications');
  });
});
