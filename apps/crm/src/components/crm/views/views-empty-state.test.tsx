// @vitest-environment jsdom
/**
 * FB-8 — Kanban and Split share the filter-aware empty state with ListView /
 * RecordTable: a missed search says "No … match" with a Clear action, never
 * "Create Record"; a genuinely empty module keeps Create / Import.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const nav: { params: URLSearchParams } = { params: new URLSearchParams('') };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => nav.params,
  usePathname: () => '/crm/modules/contacts',
}));

import { KanbanView } from './KanbanView';
import { SplitView } from './SplitView';
import { CRM_CLEAR_LIST_STATE_EVENT } from '@/lib/crm/list-empty-state';
import type { CrmField } from '@/lib/crm/types';

const FIELDS = [
  { id: 'f1', key: 'first_name', label: 'First', type: 'text', module_id: 'm', display_order: 1 },
  { id: 'f2', key: 'contact_status', label: 'Status', type: 'select', module_id: 'm', display_order: 2 },
] as unknown as CrmField[];

afterEach(() => {
  cleanup();
  nav.params = new URLSearchParams('');
});

describe.each([
  ['KanbanView', (props: Record<string, unknown>) => <KanbanView records={[]} fields={FIELDS} moduleKey="contacts" {...props} />],
  ['SplitView', (props: Record<string, unknown>) => (
    <SplitView records={[]} fields={FIELDS} moduleKey="contacts" selectedIds={new Set()} onSelectionChange={() => {}} {...props} />
  )],
])('%s empty state', (_name, make) => {
  it('missed search → "No contacts match search …" + Clear search, no Create Record', () => {
    nav.params = new URLSearchParams('search=zzz');
    render(make({ totalCount: 0 }));
    expect(screen.getByRole('status').getAttribute('data-reason')).toBe('no-match');
    expect(screen.getByText(/No contacts match search "zzz"/)).toBeTruthy();
    expect(screen.queryByText('Create Record')).toBeNull();
    expect(screen.queryByText(/No records (to display|found)/)).toBeNull();
    const listener = vi.fn();
    window.addEventListener(CRM_CLEAR_LIST_STATE_EVENT, listener);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ moduleKey: 'contacts', target: 'search' });
    window.removeEventListener(CRM_CLEAR_LIST_STATE_EVENT, listener);
  });

  it('genuinely empty module → Create Record / Import Data', () => {
    render(make({ totalCount: 0 }));
    expect(screen.getByRole('status').getAttribute('data-reason')).toBe('no-records');
    expect(screen.getByText('Create Record')).toBeTruthy();
    expect(screen.getByText('Import Data')).toBeTruthy();
  });

  it('load failure → "Try again", never Create Record', () => {
    render(make({ loadError: true }));
    expect(screen.getByRole('status').getAttribute('data-reason')).toBe('load-failed');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('Create Record')).toBeNull();
  });
});
