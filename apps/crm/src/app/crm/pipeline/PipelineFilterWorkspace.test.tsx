// @vitest-environment jsdom
/**
 * LS-8 regression — /crm/pipeline scopes its filter-rail open state to the
 * viewer (filterRailStorageKey(module, profileId)). Calling read/write without
 * a viewer id fails closed, so the rail state silently stopped persisting;
 * this pins the profile-scoped read AND write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/crm/pipeline',
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('@/hooks/useClientAuth', () => ({
  useClientAuth: () => ({ user: null, profile: { id: 'viewer-1', organization_id: 'org', full_name: null, crm_role: 'crm_agent', user_id: 'u' }, loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/components/crm/filters/FilterSidebar', () => ({ FilterSidebar: () => null }));
vi.mock('@/components/crm/filters/FilterSidebarTrigger', () => ({ FilterSidebarTrigger: () => null }));
vi.mock('@/components/crm/filters/FilterWorkspaceRow', () => ({
  FilterWorkspaceRow: ({ rail, children }: { rail: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {rail}
      {children}
    </div>
  ),
}));
vi.mock('@/components/crm/filters/FilterRailFrame', () => ({
  FilterRailFrame: ({ open, onToggle }: { open: boolean; onToggle: () => void }) => (
    <button type="button" data-testid="rail" data-state={open ? 'open' : 'closed'} onClick={onToggle} />
  ),
}));
vi.mock('./PipelineToolbar', () => ({ PipelineToolbar: () => null }));

import { PipelineFilterWorkspace } from './PipelineFilterWorkspace';
import { filterRailStorageKey } from '@/lib/crm/filter-rail';

const KEY = filterRailStorageKey('pipeline', 'viewer-1');

function mount() {
  return render(
    <PipelineFilterWorkspace fields={[]} orgId="org" filters={[]} stages={[]} canEditStages={false}>
      <div />
    </PipelineFilterWorkspace>,
  );
}

// Node >=22 pre-declares a `localStorage` global that shadows jsdom's —
// install a real in-memory Storage per test (same recipe as filter-rail.test).
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
});

afterEach(() => {
  cleanup();
});

describe('PipelineFilterWorkspace rail persistence (LS-8)', () => {
  it("reads the viewer-scoped key: a stored '0' collapses the rail", async () => {
    window.localStorage.setItem(KEY, '0');
    mount();
    await waitFor(() => expect(screen.getByTestId('rail').getAttribute('data-state')).toBe('closed'));
  });

  it('writes the viewer-scoped key on toggle so a reload keeps the choice', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('rail').getAttribute('data-state')).toBe('open'));
    fireEvent.click(screen.getByTestId('rail'));
    expect(window.localStorage.getItem(KEY)).toBe('0');
    fireEvent.click(screen.getByTestId('rail'));
    expect(window.localStorage.getItem(KEY)).toBe('1');
  });
});
