// @vitest-environment jsdom
/**
 * Road to Ten D9 / FB-1 — the list Export button is disabled (no toast) when
 * there is nothing to export: zero rows in the list and nothing selected.
 * A selection re-enables it even on a zero-row page so a stale selection can
 * still be exported from the loaded rows.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CrmModule } from '@/lib/crm/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));
// The quick-create drawer is loaded lazily by the header; the export rule
// never opens it, so a null component keeps the test to the header itself.
vi.mock('next/dynamic', () => ({ default: () => () => null }));
// DE-M1: the create button is gated on the client profile's crm_role.
const authState: { crmRole: string | null } = { crmRole: 'crm_agent' };
vi.mock('@/hooks/useClientAuth', () => ({
  useClientAuth: () => ({
    user: null,
    profile: authState.crmRole
      ? { id: 'p1', organization_id: 'org', full_name: 'Walk', crm_role: authState.crmRole, user_id: 'u1' }
      : null,
    loading: authState.crmRole === null,
    error: null,
    refetch: async () => {},
  }),
}));

import { ModuleHeader } from './ModuleHeader';

const ORG = '00000000-0000-0000-0000-000000000001';
const MODULE = {
  id: 'mod-contacts',
  org_id: ORG,
  key: 'contacts',
  name: 'Contact',
  name_plural: 'Contacts',
  is_enabled: true,
} as unknown as CrmModule;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function exportButton(): HTMLButtonElement {
  return screen.getByTestId('crm-list-export') as HTMLButtonElement;
}

describe('ModuleHeader — Export at zero rows (D9)', () => {
  it('disables Export when the list has no rows and nothing is selected, and swallows the click', () => {
    const onExport = vi.fn();
    render(<ModuleHeader module={MODULE} totalCount={0} selectedCount={0} onExport={onExport} />);

    const btn = exportButton();
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('title')).toBe('Nothing to export yet');

    fireEvent.click(btn);
    expect(onExport).not.toHaveBeenCalled();
    // The header never toasts — there is no sonner import here, and the shell
    // guard for this branch is a silent return (ModuleShell handleExport).
    expect(screen.queryByText(/No records to export/i)).toBeNull();
  });

  it('enables Export when the list has rows', () => {
    const onExport = vi.fn();
    render(<ModuleHeader module={MODULE} totalCount={35} selectedCount={0} onExport={onExport} />);

    const btn = exportButton();
    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('aria-disabled')).toBe(false);
    expect(btn.getAttribute('title')).toBe('Export this list as CSV');

    fireEvent.click(btn);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('keeps Export enabled on a zero-row page while rows are still selected', () => {
    const onExport = vi.fn();
    render(<ModuleHeader module={MODULE} totalCount={0} selectedCount={2} onExport={onExport} />);

    const btn = exportButton();
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('defaults selectedCount to 0 (legacy callers) so zero rows still disables Export', () => {
    render(<ModuleHeader module={MODULE} totalCount={0} onExport={vi.fn()} />);
    expect(exportButton().disabled).toBe(true);
  });
});

describe('ModuleHeader — create affordance by role (DE-M1 / D1)', () => {
  afterEach(() => {
    authState.crmRole = 'crm_agent';
  });

  it('shows "Add Member" to crm_agent on Contacts', () => {
    render(<ModuleHeader module={MODULE} totalCount={35} />);
    const btn = screen.getByTestId('crm-module-create');
    expect(btn.textContent).toContain('Add Member');
  });

  it('hides every create affordance from crm_viewer', () => {
    authState.crmRole = 'crm_viewer';
    render(<ModuleHeader module={MODULE} totalCount={35} />);
    expect(screen.queryByTestId('crm-module-create')).toBeNull();
    expect(screen.queryByText('Add Member')).toBeNull();
  });

  it('fails closed while the profile is still loading', () => {
    authState.crmRole = null;
    render(<ModuleHeader module={MODULE} totalCount={35} />);
    expect(screen.queryByTestId('crm-module-create')).toBeNull();
  });

  it('labels the Members list primary "Add Member" and says it saves in Contacts (D1)', () => {
    render(<ModuleHeader module={{ ...MODULE, id: 'mod-members', key: 'members', name: 'Member', name_plural: 'Members' } as CrmModule} totalCount={3} />);
    const btn = screen.getByTestId('crm-module-create');
    expect(btn.textContent).toContain('Add Member');
    expect(btn.getAttribute('title')).toMatch(/saves in Contacts/);
    expect(btn.getAttribute('title')).toMatch(/Members fills from enrollment/);
  });
});
