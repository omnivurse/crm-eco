// @vitest-environment jsdom
/**
 * LS-8 — column widths are remembered per viewer (profile id) so a second
 * user on the same browser starts from defaults; the legacy unscoped entry
 * is purged, never read; without a viewer nothing is read or written.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const authState: { profile: { id: string } | null } = { profile: null };
vi.mock('./useClientAuth', () => ({
  useClientAuth: () => ({ user: null, profile: authState.profile, loading: false, error: null, refetch: async () => {} }),
}));

import {
  columnWidthsStorageKey,
  legacyColumnWidthsStorageKey,
  useColumnResize,
} from './useColumnResize';

// Node ≥22 pre-declares a `localStorage` global (undefined without
// --localstorage-file), so vitest's jsdom environment does not install
// jsdom's Storage. Install a minimal in-memory Storage for these cases.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
  } as Storage;
}

const COLUMNS = ['first_name', 'phone'];
const getDefaultWidth = (col: string) => (col === 'phone' ? 140 : 200);

describe('storage keys', () => {
  it('scopes by viewer and keeps the legacy key distinct', () => {
    expect(columnWidthsStorageKey('contacts', 'u1')).toBe('crm_col_widths_u:u1:contacts');
    expect(columnWidthsStorageKey('contacts', 'u2')).not.toBe(columnWidthsStorageKey('contacts', 'u1'));
    expect(legacyColumnWidthsStorageKey('contacts')).toBe('crm_col_widths_contacts');
  });
});

describe('useColumnResize', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true, writable: true });
    authState.profile = null;
  });
  afterEach(() => cleanup());

  it('reads the remembered widths for the given viewer; another viewer gets the defaults', () => {
    window.localStorage.setItem(columnWidthsStorageKey('contacts', 'userA'), JSON.stringify({ phone: 260 }));
    const a = renderHook(() => useColumnResize({ columns: COLUMNS, getDefaultWidth, storageKey: 'contacts', scopeId: 'userA' }));
    expect(a.result.current.columnWidths).toEqual({ first_name: 200, phone: 260 });
    const b = renderHook(() => useColumnResize({ columns: COLUMNS, getDefaultWidth, storageKey: 'contacts', scopeId: 'userB' }));
    expect(b.result.current.columnWidths).toEqual({ first_name: 200, phone: 140 });
  });

  it('never reads the legacy unscoped entry and purges it once the viewer is known', () => {
    window.localStorage.setItem(legacyColumnWidthsStorageKey('contacts'), JSON.stringify({ phone: 999 }));
    const { result } = renderHook(() =>
      useColumnResize({ columns: COLUMNS, getDefaultWidth, storageKey: 'contacts', scopeId: 'userA' }),
    );
    expect(result.current.columnWidths.phone).toBe(140);
    expect(window.localStorage.getItem(legacyColumnWidthsStorageKey('contacts'))).toBeNull();
  });

  it('persists resets under the viewer key only, and nothing without a viewer', () => {
    const scoped = renderHook(() =>
      useColumnResize({ columns: COLUMNS, getDefaultWidth, storageKey: 'contacts', scopeId: 'userA' }),
    );
    act(() => scoped.result.current.resetAllColumnWidths());
    expect(JSON.parse(window.localStorage.getItem(columnWidthsStorageKey('contacts', 'userA')) ?? '{}')).toEqual({
      first_name: 200, phone: 140,
    });

    const unscoped = renderHook(() =>
      useColumnResize({ columns: COLUMNS, getDefaultWidth, storageKey: 'leads', scopeId: null }),
    );
    act(() => unscoped.result.current.resetAllColumnWidths());
    expect(Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)))
      .toEqual([columnWidthsStorageKey('contacts', 'userA')]);
  });

  it('falls back to the cached client profile when no scopeId is passed, hydrating once it is known', () => {
    window.localStorage.setItem(columnWidthsStorageKey('contacts', 'viewer-1'), JSON.stringify({ first_name: 320 }));
    const { result, rerender } = renderHook(() =>
      useColumnResize({ columns: COLUMNS, getDefaultWidth, storageKey: 'contacts' }),
    );
    // Viewer unknown → defaults.
    expect(result.current.columnWidths.first_name).toBe(200);
    authState.profile = { id: 'viewer-1' };
    rerender();
    expect(result.current.columnWidths.first_name).toBe(320);
  });
});
