import { describe, expect, it } from 'vitest';
import {
  clearListStateParams,
  isListNarrowed,
  readListQueryState,
  recordNounFromModuleKey,
  resolveListEmptyState,
  stepListPageParams,
  summarizeListQuery,
} from './list-empty-state';

const q = (init: Record<string, string> = {}) => readListQueryState(new URLSearchParams(init));

describe('readListQueryState', () => {
  it('defaults to an un-narrowed state', () => {
    expect(q()).toEqual({
      search: '', filterCount: 0, scope: 'all', territory: null, viewId: null, page: 1,
    });
    expect(isListNarrowed(q())).toBe(false);
    expect(readListQueryState(null).filterCount).toBe(0);
  });

  it('counts only valid filters and ignores garbage', () => {
    const filters = JSON.stringify([
      { field: 'contact_status', operator: 'in', value: ['Active'] },
      { nope: true },
      { field: 'x', operator: 'equals', value: null },
    ]);
    expect(q({ filters }).filterCount).toBe(2);
    expect(q({ filters: '{not json' }).filterCount).toBe(0);
    expect(q({ filters: '{"field":"a","operator":"b"}' }).filterCount).toBe(0);
  });

  it('parses scope, territory, view, search and page', () => {
    const s = q({ scope: 'mine', territory: 't1', view: 'v9', search: '  smith ', page: '3' });
    expect(s).toEqual({
      search: 'smith', filterCount: 0, scope: 'mine', territory: 't1', viewId: 'v9', page: 3,
    });
    expect(q({ scope: 'bogus' }).scope).toBe('all');
    expect(q({ page: '-2' }).page).toBe(1);
    expect(q({ page: 'abc' }).page).toBe(1);
  });
});

describe('summarizeListQuery', () => {
  it('joins narrowing parts in plain English', () => {
    expect(summarizeListQuery(q({ search: 'smith' }))).toBe('search "smith"');
    expect(summarizeListQuery(q({ search: 'smith', scope: 'mine' }))).toBe('search "smith" and My Records');
    const filters = JSON.stringify([{ field: 'a', operator: 'equals' }, { field: 'b', operator: 'equals' }]);
    expect(summarizeListQuery(q({ search: 'x', filters, territory: 't' })))
      .toBe('search "x", 2 filters and this territory');
    expect(summarizeListQuery(q({ filters: JSON.stringify([{ field: 'a', operator: 'equals' }]) }))).toBe('1 filter');
    expect(summarizeListQuery(q())).toBe('');
  });
});

describe('resolveListEmptyState', () => {
  it('returns null when rows exist', () => {
    expect(resolveListEmptyState({ recordCount: 3, query: q() })).toBeNull();
  });

  it('shows create/import ONLY when the module truly has zero records', () => {
    const s = resolveListEmptyState({ recordCount: 0, query: q(), recordNoun: 'contacts' });
    expect(s?.reason).toBe('no-records');
    expect(s?.showCreateImport).toBe(true);
    expect(s?.actions).toEqual([]);
    expect(s?.title).toBe('No contacts yet');
  });

  it('never offers create/import to a search that missed', () => {
    const s = resolveListEmptyState({
      recordCount: 0, totalCount: 0, query: q({ search: 'zzz' }), recordNoun: 'members',
    });
    expect(s?.reason).toBe('no-match');
    expect(s?.showCreateImport).toBe(false);
    expect(s?.title).toBe('No members match search "zzz"');
    expect(s?.actions).toEqual([{ id: 'search', label: 'Clear search' }]);
  });

  it('offers per-facet clears plus "Clear everything" when several facets are active', () => {
    const filters = JSON.stringify([{ field: 'a', operator: 'equals', value: 1 }]);
    const s = resolveListEmptyState({
      recordCount: 0, query: q({ search: 'x', filters, scope: 'downline', territory: 't', view: 'v' }),
    });
    expect(s?.reason).toBe('no-match');
    expect(s?.actions.map((a) => a.id)).toEqual(['filters', 'search', 'view', 'scope', 'territory', 'all']);
    expect(s?.showCreateImport).toBe(false);
  });

  it('treats a scope-only narrowing as a match miss, not an empty module', () => {
    const s = resolveListEmptyState({ recordCount: 0, query: q({ scope: 'mine' }) });
    expect(s?.reason).toBe('no-match');
    expect(s?.actions).toEqual([{ id: 'scope', label: 'Show all records' }]);
  });

  it('detects a page past the end of the list', () => {
    const byTotal = resolveListEmptyState({ recordCount: 0, totalCount: 500, query: q({ page: '9' }) });
    expect(byTotal?.reason).toBe('page-out-of-range');
    expect(byTotal?.actions).toEqual([{ id: 'page', label: 'Go to first page' }]);
    expect(byTotal?.showCreateImport).toBe(false);
    // Unknown total but page>1 with no narrowing → still out-of-range, not "create your first".
    const byPage = resolveListEmptyState({ recordCount: 0, query: q({ page: '2' }) });
    expect(byPage?.reason).toBe('page-out-of-range');
    // page>1 AND narrowed → the narrowing is the more useful explanation.
    const narrowedPage = resolveListEmptyState({ recordCount: 0, query: q({ page: '2', search: 'q' }) });
    expect(narrowedPage?.reason).toBe('no-match');
  });
});

describe('resolveListEmptyState — load failure (LS-2)', () => {
  it("says Couldn't load {noun} with a Try again action and never the Create CTA", () => {
    const s = resolveListEmptyState({
      recordCount: 0, totalCount: 0, query: q(), recordNoun: 'contacts', loadError: true,
    });
    expect(s?.reason).toBe('load-failed');
    expect(s?.title).toBe("Couldn't load contacts");
    expect(s?.actions).toEqual([{ id: 'retry', label: 'Try again' }]);
    expect(s?.showCreateImport).toBe(false);
  });

  it('wins over the narrowed / page-out-of-range explanations (zero rows is unknown, not empty)', () => {
    const narrowed = resolveListEmptyState({
      recordCount: 0, query: q({ search: 'zzz', page: '3' }), loadError: true,
    });
    expect(narrowed?.reason).toBe('load-failed');
    expect(narrowed?.actions.map((a) => a.id)).toEqual(['retry']);
    // Rows present → never an empty state, even if a later fetch flagged an error.
    expect(resolveListEmptyState({ recordCount: 2, query: q(), loadError: true })).toBeNull();
  });

  it('uses the ellipsis glyph, never three dots', () => {
    const s = resolveListEmptyState({ recordCount: 0, query: q(), loadError: true });
    expect(`${s?.title} ${s?.description}`).not.toContain('...');
  });
});

describe('stepListPageParams (PageUp / PageDown)', () => {
  it('steps within the filtered total using the URL page size', () => {
    const p = new URLSearchParams({ page: '2', page_size: '25', filters: '[]' });
    expect(stepListPageParams(p, 1, 60)?.get('page')).toBe('3');
    expect(stepListPageParams(p, -1, 60)?.get('page')).toBe('1');
    // Keeps the rest of the list state.
    expect(stepListPageParams(p, 1, 60)?.get('filters')).toBe('[]');
    // Does not mutate the input.
    expect(p.get('page')).toBe('2');
  });

  it('returns null at the edges and on a bad page param', () => {
    expect(stepListPageParams(new URLSearchParams({ page: '1' }), -1, 100)).toBeNull();
    expect(stepListPageParams(new URLSearchParams({ page: '4' }), 1, 100)).toBeNull(); // 4 pages of 25
    expect(stepListPageParams(new URLSearchParams({ page: 'abc' }), -1, 100)).toBeNull(); // abc → page 1
    expect(stepListPageParams(new URLSearchParams({ page: 'abc' }), 1, 100)?.get('page')).toBe('2');
    expect(stepListPageParams(new URLSearchParams(), 1, 0)).toBeNull();
    expect(stepListPageParams(new URLSearchParams(), 1, null)).toBeNull();
  });

  it('defaults the page size to 25 and honours an explicit page_size', () => {
    expect(stepListPageParams(new URLSearchParams({ page: '2' }), 1, 50)).toBeNull();
    expect(stepListPageParams(new URLSearchParams({ page: '1', page_size: '100' }), 1, 100)).toBeNull();
    expect(stepListPageParams(new URLSearchParams({ page: '1', page_size: '50' }), 1, 51)?.get('page')).toBe('2');
  });
});

describe('clearListStateParams', () => {
  const base = () => new URLSearchParams({
    filters: '[]', search: 's', scope: 'mine', territory: 't', view: 'v', page: '4', sortField: 'x',
  });

  it('drops only the requested facet and always resets paging', () => {
    expect(clearListStateParams(base(), 'filters').toString())
      .toBe('search=s&scope=mine&territory=t&view=v&sortField=x');
    expect(clearListStateParams(base(), 'search').get('search')).toBeNull();
    expect(clearListStateParams(base(), 'scope').get('scope')).toBeNull();
    expect(clearListStateParams(base(), 'territory').get('territory')).toBeNull();
    expect(clearListStateParams(base(), 'view').get('view')).toBeNull();
    expect(clearListStateParams(base(), 'page').toString())
      .toBe('filters=%5B%5D&search=s&scope=mine&territory=t&view=v&sortField=x');
  });

  it('"all" drops every narrowing facet but keeps sort/view-mode params', () => {
    const p = base();
    p.set('viewMode', 'list');
    expect(clearListStateParams(p, 'all').toString()).toBe('sortField=x&viewMode=list');
  });

  it('does not mutate the input', () => {
    const p = base();
    clearListStateParams(p, 'all');
    expect(p.get('search')).toBe('s');
  });

  it('"retry" keeps the URL untouched, including the page', () => {
    expect(clearListStateParams(base(), 'retry').toString()).toBe(base().toString());
  });
});

describe('recordNounFromModuleKey', () => {
  it('humanises module keys', () => {
    expect(recordNounFromModuleKey('contacts')).toBe('contacts');
    expect(recordNounFromModuleKey('health_insurance')).toBe('health insurance');
    expect(recordNounFromModuleKey('')).toBe('records');
    expect(recordNounFromModuleKey(undefined)).toBe('records');
  });
});
