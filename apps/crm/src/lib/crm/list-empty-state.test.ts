import { describe, expect, it } from 'vitest';
import {
  clearListStateParams,
  isListNarrowed,
  readListQueryState,
  recordNounFromModuleKey,
  resolveListEmptyState,
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
});

describe('recordNounFromModuleKey', () => {
  it('humanises module keys', () => {
    expect(recordNounFromModuleKey('contacts')).toBe('contacts');
    expect(recordNounFromModuleKey('health_insurance')).toBe('health insurance');
    expect(recordNounFromModuleKey('')).toBe('records');
    expect(recordNounFromModuleKey(undefined)).toBe('records');
  });
});
