// @vitest-environment jsdom
/**
 * LS-7 — the list pager: <nav aria-label="Pagination">, aria-current on the
 * current page, the selected rows-per-page, "Showing X to Y of N {noun}" with
 * the module noun, "Page X of Y", and plain clicks that navigate inside the
 * shell's list transition (modified clicks keep the link's own semantics).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/crm/modules/contacts',
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
// The pager lives next to the list shell; none of the shell is under test here.
vi.mock('@/components/zoho/ModuleShell', () => ({ ModuleShell: () => null }));
vi.mock('@/components/crm/records/RecordTable', () => ({ RecordTable: () => null }));
vi.mock('@/components/crm/views/ListView', () => ({ ListView: () => null }));
vi.mock('@/components/crm/views/KanbanView', () => ({ KanbanView: () => null }));
vi.mock('@/components/crm/views/TimelineView', () => ({ TimelineView: () => null }));
vi.mock('@/components/crm/views/SplitView', () => ({ SplitView: () => null }));
vi.mock('@/components/crm/views/TreeView', () => ({ TreeView: () => null }));
vi.mock('@/components/crm/views/CalendarView', () => ({ CalendarView: () => null }));

import { ListPager, visiblePageNumbers, type ListPagerModel } from './ModuleListClient';

const model = (over: Partial<ListPagerModel> = {}): ListPagerModel => ({
  page: 2,
  pageSize: 25,
  total: 60,
  totalPages: 3,
  moduleKey: 'contacts',
  baseQuery: { filters: '[]', sortField: 'created_at' },
  noun: { one: 'contact', other: 'contacts' },
  ...over,
});

describe('visiblePageNumbers', () => {
  it('shows at most five pages centred on the current one', () => {
    expect(visiblePageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(visiblePageNumbers(2, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(visiblePageNumbers(6, 10)).toEqual([4, 5, 6, 7, 8]);
    expect(visiblePageNumbers(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });
});

describe('ListPager', () => {
  afterEach(() => cleanup());

  it('is a Pagination landmark with aria-current, the module noun and Page X of Y', () => {
    render(<ListPager model={model()} navigate={vi.fn()} isPending={false} />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toBeTruthy();
    expect(screen.getByTestId('crm-pager-showing').textContent?.replace(/\s+/g, ' ')).toBe('Showing 26 to 50 of 60 contacts');
    expect(screen.getByTestId('crm-pager-page').textContent).toBe('Page 2 of 3');
    expect(screen.getByRole('link', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Page 1' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: '25 rows per page' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('link', { name: '50 rows per page' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('group', { name: 'Rows per page' })).toBeTruthy();
    expect(nav.getAttribute('aria-busy')).toBeNull();
  });

  it('singular noun for one row; pending state is announced on the landmark', () => {
    render(<ListPager model={model({ page: 1, total: 1, totalPages: 1 })} navigate={vi.fn()} isPending />);
    expect(screen.getByTestId('crm-pager-showing').textContent?.replace(/\s+/g, ' ')).toBe('Showing 1 to 1 of 1 contact');
    expect(screen.getByRole('navigation', { name: 'Pagination' }).getAttribute('aria-busy')).toBe('true');
    // A single page has no Previous / Next but still says where you are.
    expect(screen.queryByTestId('crm-pager-next')).toBeNull();
    expect(screen.getByTestId('crm-pager-page').textContent).toBe('Page 1 of 1');
  });

  it('plain click navigates inside the transition, carrying the list params; modified clicks stay links', () => {
    const navigate = vi.fn();
    render(<ListPager model={model()} navigate={navigate} isPending={false} />);
    const next = screen.getByTestId('crm-pager-next');
    expect(next.getAttribute('href')).toBe('/crm/modules/contacts?filters=%5B%5D&sortField=created_at&page=3&page_size=25');
    fireEvent.click(next);
    expect(navigate).toHaveBeenCalledWith('/crm/modules/contacts?filters=%5B%5D&sortField=created_at&page=3&page_size=25');
    // Per-page goes back to page 1.
    fireEvent.click(screen.getByRole('link', { name: '100 rows per page' }));
    expect(navigate).toHaveBeenLastCalledWith('/crm/modules/contacts?filters=%5B%5D&sortField=created_at&page=1&page_size=100');
    // ⌘-click (open in new tab) is left to the browser (jsdom cannot navigate,
    // so swallow the default after React's delegated handler has run).
    document.addEventListener('click', (e) => e.preventDefault(), { once: true });
    fireEvent.click(screen.getByRole('link', { name: 'Page 1' }), { metaKey: true });
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('disables Previous on the first page and Next on the last (aria-disabled, no navigation)', () => {
    const navigate = vi.fn();
    const { unmount } = render(<ListPager model={model({ page: 1 })} navigate={navigate} isPending={false} />);
    const prev = screen.getByTestId('crm-pager-prev');
    expect(prev.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(prev);
    expect(navigate).not.toHaveBeenCalled();
    unmount();
    render(<ListPager model={model({ page: 3 })} navigate={navigate} isPending={false} />);
    expect(screen.getByTestId('crm-pager-next').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('crm-pager-prev').getAttribute('aria-disabled')).toBeNull();
  });
});
