import { describe, expect, it } from 'vitest';
import {
  LIST_DEFAULT_PAGE_SIZE,
  applyListUrlPatch,
  listPrefsEqual,
  listPrefsStorageKey,
  legacyUnscopedListPrefsStorageKey,
  mergeListPrefs,
  pickNewerListPrefs,
  readListUrlState,
  resolveInitialListState,
  sanitizeListPrefs,
  sanitizeListPrefsMap,
  validateListPrefsAgainstFields,
} from './list-preferences';

const fields = [
  { key: 'first_name', is_title_field: true, display_order: 1 },
  { key: 'last_name', display_order: 2 },
  { key: 'email', display_order: 3 },
  { key: 'contact_status', display_order: 4 },
  { key: 'created_at', display_order: 5 },
];

const url = (init: Record<string, string> = {}) => readListUrlState(new URLSearchParams(init));

describe('sanitizeListPrefs', () => {
  it('returns null for garbage', () => {
    expect(sanitizeListPrefs(null)).toBeNull();
    expect(sanitizeListPrefs('x')).toBeNull();
    expect(sanitizeListPrefs([])).toBeNull();
    expect(sanitizeListPrefs({})).toBeNull();
    expect(sanitizeListPrefs({ scope: 'everyone', viewMode: 'holo', columns: [] })).toBeNull();
  });

  it('keeps only well-formed keys and stamps the version', () => {
    expect(
      sanitizeListPrefs({
        columns: ['a', 'b', 'a', 7, ''],
        sort: { field: 'created_at', direction: 'sideways' },
        scope: 'mine',
        viewMode: 'list',
        updated_at: 123,
        junk: true,
      }),
    ).toEqual({
      v: 1,
      columns: ['a', 'b'],
      sort: { field: 'created_at', direction: 'asc' },
      scope: 'mine',
      viewMode: 'list',
      updated_at: 123,
    });
    expect(sanitizeListPrefs({ sort: null })).toEqual({ v: 1, sort: null });
    expect(sanitizeListPrefs({ viewMode: 'tree' })?.viewMode).toBe('tree');
  });

  it('sanitizes a whole map and drops empty modules', () => {
    expect(sanitizeListPrefsMap({ contacts: { scope: 'downline' }, members: 'nope', leads: {} })).toEqual({
      contacts: { v: 1, scope: 'downline' },
    });
    expect(sanitizeListPrefsMap(null)).toEqual({});
  });
});

describe('validateListPrefsAgainstFields', () => {
  it('drops unknown columns and sort fields', () => {
    const prefs = { columns: ['first_name', 'ghost', 'email'], sort: { field: 'ghost', direction: 'desc' as const } };
    expect(validateListPrefsAgainstFields(prefs, fields)).toEqual({ columns: ['first_name', 'email'] });
  });

  it('removes columns entirely when none survive (so defaults apply)', () => {
    expect(validateListPrefsAgainstFields({ columns: ['ghost'], scope: 'mine' }, fields)).toEqual({ scope: 'mine' });
  });

  it('returns the same object when nothing changed', () => {
    const prefs = { columns: ['email'], sort: { field: 'email', direction: 'asc' as const } };
    expect(validateListPrefsAgainstFields(prefs, fields)).toBe(prefs);
    expect(validateListPrefsAgainstFields(null, fields)).toBeNull();
  });
});

describe('mergeListPrefs / pickNewer / equal', () => {
  it('merges partial patches and stamps updated_at', () => {
    const base = mergeListPrefs(null, { columns: ['a', 'a', 'b'] }, 10);
    expect(base).toEqual({ v: 1, columns: ['a', 'b'], updated_at: 10 });
    const next = mergeListPrefs(base, { scope: 'mine', sort: null }, 20);
    expect(next).toEqual({ v: 1, columns: ['a', 'b'], scope: 'mine', sort: null, updated_at: 20 });
    // undefined leaves the key alone
    expect(mergeListPrefs(next, { viewMode: 'list' }, 30).scope).toBe('mine');
  });

  it('newer timestamp wins, server wins ties/unknown', () => {
    const server = { scope: 'mine' as const, updated_at: 5 };
    const local = { scope: 'downline' as const, updated_at: 9 };
    expect(pickNewerListPrefs(server, local)).toBe(local);
    expect(pickNewerListPrefs({ scope: 'mine', updated_at: 9 }, { scope: 'downline', updated_at: 9 })?.scope).toBe('mine');
    expect(pickNewerListPrefs(null, local)).toBe(local);
    expect(pickNewerListPrefs(server, null)).toBe(server);
    expect(pickNewerListPrefs(server, { scope: 'downline' })).toBe(server);
  });

  it('compares structurally, ignoring updated_at', () => {
    expect(listPrefsEqual({ columns: ['a'], updated_at: 1 }, { columns: ['a'], updated_at: 2 })).toBe(true);
    expect(listPrefsEqual({ columns: ['a', 'b'] }, { columns: ['b', 'a'] })).toBe(false);
    expect(listPrefsEqual({ sort: { field: 'a', direction: 'asc' } }, { sort: { field: 'a', direction: 'desc' } })).toBe(false);
    expect(listPrefsEqual(null, undefined)).toBe(true);
  });

  it('builds a versioned storage key scoped by profile id', () => {
    expect(listPrefsStorageKey('contacts', 'p-1')).toBe('crm:list-prefs:v1:u:p-1:contacts');
    // Two users on one browser never share a key.
    expect(listPrefsStorageKey('contacts', 'p-1')).not.toBe(listPrefsStorageKey('contacts', 'p-2'));
    // The pre-scoping key is only for purging, and differs from every scoped key.
    expect(legacyUnscopedListPrefsStorageKey('contacts')).toBe('crm:list-prefs:v1:contacts');
    expect(legacyUnscopedListPrefsStorageKey('contacts')).not.toBe(listPrefsStorageKey('contacts', 'p-1'));
  });
});

describe('readListUrlState', () => {
  it('reads and validates the pref-managed keys', () => {
    expect(url()).toEqual({ viewId: null, sortField: null, sortDirection: null, scope: null, viewMode: null, pageSize: null });
    expect(url({ view: 'v1', sortField: 'email', sortDirection: 'desc', scope: 'mine', viewMode: 'kanban' })).toEqual({
      viewId: 'v1', sortField: 'email', sortDirection: 'desc', scope: 'mine', viewMode: 'kanban', pageSize: null,
    });
    expect(url({ sortDirection: 'up', scope: 'team', viewMode: 'nope' })).toEqual({
      viewId: null, sortField: null, sortDirection: null, scope: null, viewMode: null, pageSize: null,
    });
  });
});

describe('resolveInitialListState', () => {
  const view = { id: 'v-default', columns: ['first_name', 'last_name'], sort: [{ field: 'created_at', direction: 'desc' as const }] };

  it('falls back to view, then module defaults, when nothing is remembered', () => {
    const r = resolveInitialListState({ url: url(), prefs: null, activeView: view, fields });
    expect(r.columns).toEqual(['first_name', 'last_name']);
    expect(r.source).toEqual({ columns: 'view', sort: 'view', scope: 'default', viewMode: 'default', pageSize: 'default' });
    expect(r.sort).toEqual({ field: 'created_at', direction: 'desc' });
    expect(r.urlPatch).toEqual({});

    const noView = resolveInitialListState({ url: url(), prefs: null, activeView: null, fields });
    expect(noView.source.columns).toBe('default');
    expect(noView.columns.length).toBeGreaterThan(0);
    expect(noView.sort).toBeNull();
    expect(noView.scope).toBe('all');
    expect(noView.viewMode).toBe('table');
  });

  it('remembered prefs beat the default view and produce a URL patch for server-side keys', () => {
    const prefs = {
      columns: ['email', 'contact_status'],
      sort: { field: 'email', direction: 'asc' as const },
      scope: 'mine' as const,
      viewMode: 'list' as const,
    };
    const r = resolveInitialListState({ url: url(), prefs, activeView: view, fields });
    expect(r.columns).toEqual(['email', 'contact_status']);
    expect(r.sort).toEqual({ field: 'email', direction: 'asc' });
    expect(r.scope).toBe('mine');
    expect(r.viewMode).toBe('list');
    expect(r.source).toEqual({ columns: 'prefs', sort: 'prefs', scope: 'prefs', viewMode: 'prefs', pageSize: 'default' });
    expect(r.urlPatch).toEqual({ sortField: 'email', sortDirection: 'asc', scope: 'mine', viewMode: 'list' });
  });

  it('does not patch the URL for values that equal the defaults', () => {
    const r = resolveInitialListState({
      url: url(),
      prefs: { scope: 'all', viewMode: 'table', columns: ['email'] },
      activeView: view,
      fields,
    });
    expect(r.urlPatch).toEqual({});
    expect(r.scope).toBe('all');
    expect(r.viewMode).toBe('table');
  });

  it('explicit URL params always win over prefs', () => {
    const r = resolveInitialListState({
      url: url({ sortField: 'last_name', sortDirection: 'desc', scope: 'downline', viewMode: 'split' }),
      prefs: { sort: { field: 'email', direction: 'asc' }, scope: 'mine', viewMode: 'list' },
      activeView: view,
      fields,
    });
    expect(r.sort).toEqual({ field: 'last_name', direction: 'desc' });
    expect(r.scope).toBe('downline');
    expect(r.viewMode).toBe('split');
    expect(r.urlPatch).toEqual({});
    expect(r.source.sort).toBe('url');
  });

  it('an explicit ?view= makes that view the pref for columns + sort', () => {
    const r = resolveInitialListState({
      url: url({ view: 'v-default' }),
      prefs: { columns: ['email'], sort: { field: 'email', direction: 'asc' }, scope: 'mine' },
      activeView: view,
      fields,
    });
    expect(r.columns).toEqual(['first_name', 'last_name']);
    expect(r.sort).toEqual({ field: 'created_at', direction: 'desc' });
    expect(r.source.columns).toBe('url-view');
    expect(r.source.sort).toBe('url-view');
    // scope is not part of a crm_view, so the pref still applies
    expect(r.scope).toBe('mine');
    expect(r.urlPatch).toEqual({ scope: 'mine' });
  });

  it('ignores a ?view= that does not match the resolved view', () => {
    const r = resolveInitialListState({
      url: url({ view: 'stale' }),
      prefs: { columns: ['email'] },
      activeView: view,
      fields,
    });
    expect(r.columns).toEqual(['email']);
  });

  it('drops stale pref columns/sort before resolving', () => {
    const r = resolveInitialListState({
      url: url(),
      prefs: { columns: ['ghost'], sort: { field: 'ghost', direction: 'asc' } },
      activeView: view,
      fields,
    });
    expect(r.columns).toEqual(['first_name', 'last_name']);
    expect(r.sort).toEqual({ field: 'created_at', direction: 'desc' });
    expect(r.urlPatch).toEqual({});
  });
});

describe('applyListUrlPatch', () => {
  it('adds only missing keys and returns null when nothing changed', () => {
    const p = new URLSearchParams({ scope: 'downline', page: '3' });
    const next = applyListUrlPatch(p, { scope: 'mine', viewMode: 'list' });
    expect(next?.get('scope')).toBe('downline');
    expect(next?.get('viewMode')).toBe('list');
    expect(next?.get('page')).toBe('3');
    expect(applyListUrlPatch(p, { scope: 'mine' })).toBeNull();
    expect(applyListUrlPatch(p, {})).toBeNull();
  });
});

describe('pageSize (LS-7 / D11: remembered rows-per-page)', () => {
  it('sanitizes to the allowed sizes only', () => {
    expect(sanitizeListPrefs({ pageSize: 50 })).toEqual({ v: 1, pageSize: 50 });
    expect(sanitizeListPrefs({ pageSize: 100 })?.pageSize).toBe(100);
    expect(sanitizeListPrefs({ pageSize: 25 })?.pageSize).toBe(25);
    expect(sanitizeListPrefs({ pageSize: 30 })).toBeNull();
    expect(sanitizeListPrefs({ pageSize: '50' })).toBeNull();
  });

  it('merges, compares and reads the URL page_size', () => {
    const merged = mergeListPrefs({ v: 1, scope: 'mine' }, { pageSize: 100 }, 5);
    expect(merged).toEqual({ v: 1, scope: 'mine', pageSize: 100, updated_at: 5 });
    expect(listPrefsEqual({ pageSize: 50 }, { pageSize: 50 })).toBe(true);
    expect(listPrefsEqual({ pageSize: 50 }, { pageSize: 100 })).toBe(false);
    expect(url({ page_size: '50' }).pageSize).toBe(50);
    expect(url({ page_size: '33' }).pageSize).toBeNull();
    expect(url().pageSize).toBeNull();
  });

  it('URL > prefs > default 25, and only a non-default remembered size is patched into the URL', () => {
    const fromUrl = resolveInitialListState({ url: url({ page_size: '100' }), prefs: { pageSize: 50 }, activeView: null, fields });
    expect(fromUrl.pageSize).toBe(100);
    expect(fromUrl.source.pageSize).toBe('url');
    expect(fromUrl.urlPatch.page_size).toBeUndefined();

    const fromPrefs = resolveInitialListState({ url: url(), prefs: { pageSize: 50 }, activeView: null, fields });
    expect(fromPrefs.pageSize).toBe(50);
    expect(fromPrefs.source.pageSize).toBe('prefs');
    expect(fromPrefs.urlPatch).toEqual({ page_size: '50' });

    const remembered25 = resolveInitialListState({ url: url(), prefs: { pageSize: 25 }, activeView: null, fields });
    expect(remembered25.source.pageSize).toBe('prefs');
    expect(remembered25.urlPatch.page_size).toBeUndefined();

    const none = resolveInitialListState({ url: url(), prefs: null, activeView: null, fields });
    expect(none.pageSize).toBe(LIST_DEFAULT_PAGE_SIZE);
    expect(none.source.pageSize).toBe('default');
  });

  it('applyListUrlPatch never overwrites an explicit page_size', () => {
    const params = new URLSearchParams({ page_size: '100' });
    expect(applyListUrlPatch(params, { page_size: '50' })).toBeNull();
    expect(applyListUrlPatch(new URLSearchParams(), { page_size: '50' })?.get('page_size')).toBe('50');
  });
});
