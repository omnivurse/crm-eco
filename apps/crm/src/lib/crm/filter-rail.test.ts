// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FILTER_RAIL_DEFAULT_OPEN,
  railKeyTargetInOwnKeyScope,
  FILTER_RAIL_STORAGE_PREFIX,
  applyFilterButtonLabel,
  filterModuleByTitle,
  filterRailStorageKey,
  legacyFilterRailStorageKey,
  moduleFilterRailTitle,
  parseFilterRailOpen,
  purgeLegacyFilterRailKey,
  readFilterRailOpen,
  shouldCloseFilterHost,
  subscribeFilterRailOpen,
  writeFilterRailOpen,
} from './filter-rail';

describe('filterModuleByTitle', () => {
  it('names the rail after the module', () => {
    expect(filterModuleByTitle('Contacts')).toBe('Filter Contacts by');
    expect(filterModuleByTitle('Leads')).toBe('Filter Leads by');
    expect(filterModuleByTitle('Members')).toBe('Filter Members by');
    expect(filterModuleByTitle('Accounts')).toBe('Filter Accounts by');
    expect(filterModuleByTitle('Pipeline')).toBe('Filter Pipeline by');
  });

  it('falls back when the name is blank', () => {
    expect(filterModuleByTitle('   ')).toBe('Filter Records by');
  });
});

describe('moduleFilterRailTitle', () => {
  it('prefers the plural name', () => {
    expect(
      moduleFilterRailTitle({ name: 'Contact', name_plural: 'Contacts', key: 'contacts' }),
    ).toBe('Filter Contacts by');
  });
});

describe('shouldCloseFilterHost', () => {
  it('closes a dialog host after Apply', () => {
    expect(shouldCloseFilterHost('dialog')).toBe(true);
  });

  it('does not unmount a docked rail after Apply', () => {
    expect(shouldCloseFilterHost('docked')).toBe(false);
  });
});

describe('applyFilterButtonLabel', () => {
  it('names the docked primary action Apply Filter so the rail footer is obvious', () => {
    expect(applyFilterButtonLabel('docked')).toBe('Apply Filter');
    expect(applyFilterButtonLabel('docked', 2)).toBe('Apply Filter (2)');
  });

  it('keeps the dialog label short', () => {
    expect(applyFilterButtonLabel('dialog')).toBe('Apply');
    expect(applyFilterButtonLabel('dialog', 1)).toBe('Apply (1)');
  });
});

describe('filterRailStorageKey (LS-8: scoped by viewer)', () => {
  it('is per-module AND per-profile, distinct from the legacy unscoped key', () => {
    expect(filterRailStorageKey('contacts', 'u1')).toBe(`${FILTER_RAIL_STORAGE_PREFIX}u:u1:contacts`);
    expect(filterRailStorageKey('leads', 'u1')).toBe(`${FILTER_RAIL_STORAGE_PREFIX}u:u1:leads`);
    expect(filterRailStorageKey('contacts', 'u2')).not.toBe(filterRailStorageKey('contacts', 'u1'));
    expect(legacyFilterRailStorageKey('contacts')).toBe(`${FILTER_RAIL_STORAGE_PREFIX}contacts`);
    expect(legacyFilterRailStorageKey('contacts')).not.toBe(filterRailStorageKey('contacts', 'u1'));
  });
});

describe('parseFilterRailOpen', () => {
  it('decodes 1/0 and defaults anything else', () => {
    expect(parseFilterRailOpen('1')).toBe(true);
    expect(parseFilterRailOpen('0')).toBe(false);
    expect(parseFilterRailOpen(null)).toBe(FILTER_RAIL_DEFAULT_OPEN);
    expect(parseFilterRailOpen('yes')).toBe(FILTER_RAIL_DEFAULT_OPEN);
  });
});

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

describe('read / write / purge (localStorage)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true, writable: true });
  });

  it('remembers per viewer: user B on the same browser gets the default', () => {
    writeFilterRailOpen('contacts', false, 'userA');
    expect(readFilterRailOpen('contacts', 'userA')).toBe(false);
    expect(readFilterRailOpen('contacts', 'userB')).toBe(FILTER_RAIL_DEFAULT_OPEN);
    expect(readFilterRailOpen('leads', 'userA')).toBe(FILTER_RAIL_DEFAULT_OPEN);
  });

  it('fails closed without a viewer: neither reads nor writes', () => {
    writeFilterRailOpen('contacts', false, null);
    expect(window.localStorage.length).toBe(0);
    window.localStorage.setItem(legacyFilterRailStorageKey('contacts'), '0');
    expect(readFilterRailOpen('contacts', null)).toBe(FILTER_RAIL_DEFAULT_OPEN);
    // The legacy unscoped value is never a hydration source, even with a viewer.
    expect(readFilterRailOpen('contacts', 'userA')).toBe(FILTER_RAIL_DEFAULT_OPEN);
  });

  it('purges only the legacy unscoped key', () => {
    window.localStorage.setItem(legacyFilterRailStorageKey('contacts'), '0');
    writeFilterRailOpen('contacts', false, 'userA');
    purgeLegacyFilterRailKey('contacts');
    expect(window.localStorage.getItem(legacyFilterRailStorageKey('contacts'))).toBeNull();
    expect(readFilterRailOpen('contacts', 'userA')).toBe(false);
  });

  it('notifies subscribers on write so useSyncExternalStore re-reads', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFilterRailOpen(listener);
    writeFilterRailOpen('contacts', true, 'userA');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    writeFilterRailOpen('contacts', false, 'userA');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('railKeyTargetInOwnKeyScope (LS-8 Escape guard)', () => {
  const build = (html: string): Element => {
    document.body.innerHTML = html;
    return document.getElementById('t')!;
  };

  it('a value input inside the rail ACCORDION (data-state=open) is NOT its own key scope', () => {
    const t = build('<div data-state="open"><div data-state="open"><input id="t" /></div></div>');
    expect(railKeyTargetInOwnKeyScope(t)).toBe(false);
  });

  it('open popper content, dialogs and expanded triggers keep their own Escape', () => {
    expect(railKeyTargetInOwnKeyScope(build('<div data-radix-popper-content-wrapper=""><input id="t" /></div>'))).toBe(true);
    expect(railKeyTargetInOwnKeyScope(build('<div role="dialog"><input id="t" /></div>'))).toBe(true);
    expect(railKeyTargetInOwnKeyScope(build('<div role="listbox"><input id="t" /></div>'))).toBe(true);
    expect(railKeyTargetInOwnKeyScope(build('<button id="t" aria-expanded="true"></button>'))).toBe(true);
  });
});

