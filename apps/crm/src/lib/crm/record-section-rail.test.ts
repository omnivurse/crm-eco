// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECORD_SECTION_RAIL_DEFAULT_OPEN,
  RECORD_SECTION_RAIL_STORAGE_KEY,
  parseRecordSectionRailOpen,
  readRecordSectionRailOpen,
  subscribeRecordSectionRailOpen,
  writeRecordSectionRailOpen,
} from './record-section-rail';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  } as Storage;
}

describe('parseRecordSectionRailOpen', () => {
  it('decodes 1/0 and defaults anything else to open', () => {
    expect(parseRecordSectionRailOpen('1')).toBe(true);
    expect(parseRecordSectionRailOpen('0')).toBe(false);
    expect(parseRecordSectionRailOpen(null)).toBe(RECORD_SECTION_RAIL_DEFAULT_OPEN);
    expect(parseRecordSectionRailOpen('yes')).toBe(RECORD_SECTION_RAIL_DEFAULT_OPEN);
    expect(RECORD_SECTION_RAIL_DEFAULT_OPEN).toBe(true);
  });
});

describe('read / write (localStorage)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  it('defaults open when nothing is stored', () => {
    expect(readRecordSectionRailOpen()).toBe(true);
  });

  it('remembers a collapse', () => {
    writeRecordSectionRailOpen(false);
    expect(window.localStorage.getItem(RECORD_SECTION_RAIL_STORAGE_KEY)).toBe('0');
    expect(readRecordSectionRailOpen()).toBe(false);
  });

  it('notifies subscribers on write so useSyncExternalStore re-reads', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeRecordSectionRailOpen(listener);
    writeRecordSectionRailOpen(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    writeRecordSectionRailOpen(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
