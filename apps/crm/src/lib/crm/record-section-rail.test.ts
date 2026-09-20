// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECORD_SECTION_RAIL_DEFAULT_OPEN,
  RECORD_SECTION_RAIL_STORAGE_KEY,
  computeRecordSectionRailMaxHeight,
  parseRecordSectionRailOpen,
  readRecordSectionRailOpen,
  scrollChildIntoNearest,
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

describe('computeRecordSectionRailMaxHeight', () => {
  it('uses the leftover viewport under a stuck rail', () => {
    expect(
      computeRecordSectionRailMaxHeight({
        railTop: 200,
        viewportHeight: 900,
        bottomPad: 16,
      }),
    ).toBe(684);
  });

  it('never shrinks below the minimum so the rail stays usable', () => {
    expect(
      computeRecordSectionRailMaxHeight({
        railTop: 880,
        viewportHeight: 900,
        minHeight: 160,
      }),
    ).toBe(160);
  });
});

describe('scrollChildIntoNearest', () => {
  it('moves only the container scrollTop to reveal a clipped child', () => {
    const container = document.createElement('div');
    const child = document.createElement('button');
    container.appendChild(child);
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 300,
      height: 200,
      width: 100,
      left: 0,
      right: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    vi.spyOn(child, 'getBoundingClientRect').mockReturnValue({
      top: 340,
      bottom: 364,
      height: 24,
      width: 80,
      left: 8,
      right: 88,
      x: 8,
      y: 340,
      toJSON: () => ({}),
    });
    scrollChildIntoNearest(container, child);
    expect(container.scrollTop).toBe(64);
  });
});
