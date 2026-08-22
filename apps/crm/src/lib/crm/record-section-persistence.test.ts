import { afterEach, describe, expect, it } from 'vitest';
import {
  consumePersistedScrollTop,
  parsePersistedRecordScroll,
  persistRecordScrollTop,
} from './record-section-persistence';

const RECORD_ID = 'rec-notes-skip';
const STORAGE_KEY = `crm.record.${RECORD_ID}.scrollTop`;

function mockSessionStorage() {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage },
  });
  return store;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('parsePersistedRecordScroll', () => {
  it('reads the legacy raw-number payload as Details / Overview', () => {
    expect(parsePersistedRecordScroll('800')).toEqual({
      top: 800,
      pane: 'details',
      tab: 'overview',
    });
  });

  it('reads pane-aware JSON', () => {
    expect(parsePersistedRecordScroll('{"top":240,"pane":"notes","tab":"overview"}')).toEqual({
      top: 240,
      pane: 'notes',
      tab: 'overview',
    });
  });
});

describe('consumePersistedScrollTop chrome match', () => {
  it('does not apply a Details persist onto the Notes pane', () => {
    const store = mockSessionStorage();
    persistRecordScrollTop(RECORD_ID, 800, { pane: 'details', tab: 'overview' });
    expect(consumePersistedScrollTop(RECORD_ID, { pane: 'notes', tab: 'overview' })).toBeNull();
    expect(store.get(STORAGE_KEY)).toBeTruthy();
  });

  it('restores only when the pane still matches', () => {
    mockSessionStorage();
    persistRecordScrollTop(RECORD_ID, 240, { pane: 'notes', tab: 'overview' });
    expect(consumePersistedScrollTop(RECORD_ID, { pane: 'notes', tab: 'overview' })).toBe(240);
    expect(consumePersistedScrollTop(RECORD_ID, { pane: 'notes', tab: 'overview' })).toBeNull();
  });
});
