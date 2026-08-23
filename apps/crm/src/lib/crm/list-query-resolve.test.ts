import { describe, it, expect } from 'vitest';
import {
  LIST_QUERY_URL_KEYS,
  forwardListUrlQueryParams,
  habitPreferredViewId,
  loadListQueryState,
  normalizeListScope,
  parseListFiltersParam,
  readListUrlQueryState,
  resolveListFilters,
  resolveListQueryState,
  resolveListSort,
  resolveListView,
} from './list-query-resolve';
import type { CrmView, ViewFilter } from './types';

const view = (id: string, extra: Partial<CrmView> = {}): CrmView =>
  ({
    id,
    module_id: 'mod-1',
    name: id,
    columns: [],
    filters: [],
    sort: [],
    is_default: false,
    ...extra,
  }) as unknown as CrmView;

const pendingLane: ViewFilter = { field: 'contact_status', operator: 'in', value: ['Pending'] };
const activeLane: ViewFilter = { field: 'contact_status', operator: 'in', value: ['Active'] };

const V_DEFAULT = view('v-default', { is_default: true, filters: [activeLane], sort: [{ field: 'title', direction: 'asc' }] });
const V_HABIT = view('v-habit', { filters: [pendingLane] });
const V_URL = view('v-url', { filters: [{ field: 'city', operator: 'equals', value: 'Austin' }], sort: [{ field: 'created_at', direction: 'desc' }] });
const VIEWS = [V_DEFAULT, V_HABIT, V_URL];

describe('readListUrlQueryState / forwardListUrlQueryParams', () => {
  it('reads exactly the row-set keys buildListQuery writes (truthy only)', () => {
    const params = new URLSearchParams({
      page: '3',
      page_size: '50',
      viewMode: 'kanban',
      treeGroupBy: 'advisor',
      view: 'v-url',
      search: 'wen',
      scope: 'mine',
      sortField: 'created_at',
      sortDirection: 'desc',
      filters: JSON.stringify([pendingLane]),
      territory: 'ter-1',
      advisor_id: 'adv-1',
      group_id: '',
    });
    const state = readListUrlQueryState(params);
    expect(state).toEqual({
      view: 'v-url',
      search: 'wen',
      scope: 'mine',
      sortField: 'created_at',
      sortDirection: 'desc',
      filters: JSON.stringify([pendingLane]),
      territory: 'ter-1',
    });
    // page / page_size / viewMode / treeGroupBy never change the row set; the
    // legacy contacts-API narrowers are not part of the list URL at all.
    expect(Object.keys(state)).not.toContain('page');
    expect(Object.keys(state)).not.toContain('advisor_id');
    expect(LIST_QUERY_URL_KEYS).toEqual(['view', 'search', 'scope', 'sortField', 'sortDirection', 'filters', 'territory']);
  });

  it('accepts the page.tsx searchParams record shape too', () => {
    expect(readListUrlQueryState({ view: 'v-url', scope: undefined, filters: '' })).toEqual({ view: 'v-url' });
  });

  it('forwards the list URL onto the ids request exactly (same keys, truthy only)', () => {
    const listUrl = new URLSearchParams('page=2&view=v-url&filters=%5B%5D&scope=all&territory=&search=wen&advisor_id=adv-1');
    const out = new URLSearchParams({ module_key: 'contacts' });
    forwardListUrlQueryParams(listUrl, out);
    expect(out.toString()).toBe('module_key=contacts&view=v-url&search=wen&scope=all&filters=%5B%5D');
    // What the server reads back is what the client forwarded.
    expect(readListUrlQueryState(out)).toEqual(readListUrlQueryState(listUrl));
  });
});

describe('resolveListView precedence', () => {
  it('URL ?view= wins when it belongs to the module', () => {
    expect(resolveListView({ views: VIEWS, defaultView: V_DEFAULT, viewId: 'v-url', habitViewId: 'v-habit' })).toBe(V_URL);
  });
  it('falls back to the habit-preferred view, then the default, then null', () => {
    expect(resolveListView({ views: VIEWS, defaultView: V_DEFAULT, viewId: 'v-from-other-module', habitViewId: 'v-habit' })).toBe(V_HABIT);
    expect(resolveListView({ views: VIEWS, defaultView: V_DEFAULT, habitViewId: 'v-deleted' })).toBe(V_DEFAULT);
    expect(resolveListView({ views: VIEWS, defaultView: null })).toBeNull();
  });
});

describe('resolveListSort / resolveListFilters', () => {
  it('URL sort overrides the view sort; direction defaults to asc', () => {
    expect(resolveListSort(V_URL)).toEqual([{ field: 'created_at', direction: 'desc' }]);
    expect(resolveListSort(V_URL, 'title')).toEqual([{ field: 'title', direction: 'asc' }]);
    expect(resolveListSort(V_URL, 'title', 'desc')).toEqual([{ field: 'title', direction: 'desc' }]);
    expect(resolveListSort(null)).toEqual([]);
  });

  it('URL filters override the view filters only when a non-empty array parses', () => {
    expect(parseListFiltersParam(JSON.stringify([pendingLane]))).toEqual([pendingLane]);
    expect(parseListFiltersParam('[]')).toBeNull();
    expect(parseListFiltersParam('{"field":"x"}')).toBeNull();
    expect(parseListFiltersParam('not json')).toBeNull();
    expect(parseListFiltersParam(undefined)).toBeNull();

    expect(resolveListFilters(V_DEFAULT, JSON.stringify([pendingLane]))).toEqual([pendingLane]);
    expect(resolveListFilters(V_DEFAULT, '[]')).toEqual([activeLane]);
    expect(resolveListFilters(V_DEFAULT, 'not json')).toEqual([activeLane]);
    expect(resolveListFilters(null, undefined)).toEqual([]);
  });
});

describe('normalizeListScope / habitPreferredViewId', () => {
  it('only mine|downline survive; everything else is all', () => {
    expect(normalizeListScope('mine')).toBe('mine');
    expect(normalizeListScope('downline')).toBe('downline');
    expect(normalizeListScope('all')).toBe('all');
    expect(normalizeListScope('team')).toBe('all');
    expect(normalizeListScope(undefined)).toBe('all');
  });

  it('reads the habit-preferred view for the module off ui_preferences', () => {
    const prefs = { habits: { version: 1, preferred_views: { contacts: 'v-habit' } } };
    expect(habitPreferredViewId(prefs, 'contacts')).toBe('v-habit');
    expect(habitPreferredViewId(prefs, 'leads')).toBeNull();
    expect(habitPreferredViewId({ habits: { version: 2, preferred_views: { contacts: 'v-habit' } } }, 'contacts')).toBeNull();
    expect(habitPreferredViewId(null, 'contacts')).toBeNull();
  });
});

describe('resolveListQueryState (the page + ids-route contract)', () => {
  it('lane chip URL: ?filters= beats the default view, scope/territory/search normalised', () => {
    const state = resolveListQueryState({
      views: VIEWS,
      defaultView: V_DEFAULT,
      habitViewId: null,
      url: readListUrlQueryState(new URLSearchParams({
        filters: JSON.stringify([pendingLane]),
        scope: 'weird',
        territory: '',
        search: '   ',
      })),
    });
    expect(state.currentView).toBe(V_DEFAULT);
    expect(state.filters).toEqual([pendingLane]);
    expect(state.sort).toEqual([{ field: 'title', direction: 'asc' }]);
    expect(state.scope).toBe('all');
    expect(state.search).toBeUndefined();
    expect(state.territoryId).toBeUndefined();
  });

  it('bare module URL: habit view filters + sort apply (what the page renders with no params)', () => {
    const state = resolveListQueryState({ views: VIEWS, defaultView: V_DEFAULT, habitViewId: 'v-habit', url: {} });
    expect(state.currentView).toBe(V_HABIT);
    expect(state.filters).toEqual([pendingLane]);
    expect(state.sort).toEqual([]);
  });

  it('loadListQueryState tolerates a failing view loader the way the page does', async () => {
    const state = await loadListQueryState({
      moduleKey: 'contacts',
      loadViews: async () => { throw new Error('views down'); },
      loadDefaultView: async () => V_DEFAULT,
      uiPreferences: { habits: { version: 1, preferred_views: { contacts: 'v-habit' } } },
      url: { scope: 'mine', territory: 'ter-1', search: 'wen' },
    });
    // Habit view cannot be found in an empty views list → default view.
    expect(state.currentView).toBe(V_DEFAULT);
    expect(state.filters).toEqual([activeLane]);
    expect(state.scope).toBe('mine');
    expect(state.territoryId).toBe('ter-1');
    expect(state.search).toBe('wen');
  });
});
