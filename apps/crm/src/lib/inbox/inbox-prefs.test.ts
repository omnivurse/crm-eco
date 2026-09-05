import { describe, expect, it } from 'vitest';
import {
  INBOX_PREFS_DEFAULTS,
  MAX_PINNED_CONVERSATIONS,
  inboxPrefsStorageKey,
  mergeInboxPrefs,
  normalizeInboxPrefs,
  pickFresherInboxPrefs,
  resolveInboxPrefs,
  togglePinned,
  toggleQuickFilter,
} from './inbox-prefs';

describe('normalizeInboxPrefs', () => {
  it('drops keys the UI cannot trust rather than defaulting them in place', () => {
    const prefs = normalizeInboxPrefs({
      reading_pane: 'diagonal',
      density: 'cozy',
      thread_order: 'sideways',
      sort: { field: 'colour', direction: 'desc' },
      quick_filters: ['unread', 'nonsense'],
      pinned: ['a', '', 'a', 'b'],
      collapse_nav_on_inbox: 'yes',
    });

    expect(prefs.reading_pane).toBeUndefined();
    expect(prefs.thread_order).toBeUndefined();
    expect(prefs.sort).toBeUndefined();
    expect(prefs.collapse_nav_on_inbox).toBeUndefined();
    expect(prefs.density).toBe('cozy');
    expect(prefs.quick_filters).toEqual(['unread']);
    expect(prefs.pinned).toEqual(['a', 'b']);
  });

  it('survives junk without throwing', () => {
    expect(normalizeInboxPrefs(null)).toEqual({});
    expect(normalizeInboxPrefs('nope')).toEqual({});
    expect(normalizeInboxPrefs(42)).toEqual({});
  });

  it('defaults a sort direction but never invents a field', () => {
    expect(normalizeInboxPrefs({ sort: { field: 'from' } }).sort).toEqual({
      field: 'from',
      direction: 'desc',
    });
    expect(normalizeInboxPrefs({ sort: { direction: 'asc' } }).sort).toBeUndefined();
  });

  it('caps pins so the pinned band stays a shortcut', () => {
    const many = Array.from({ length: MAX_PINNED_CONVERSATIONS + 10 }, (_, i) => `c${i}`);
    expect(normalizeInboxPrefs({ pinned: many }).pinned).toHaveLength(MAX_PINNED_CONVERSATIONS);
  });

  it('keeps a deliberate false apart from an absent value', () => {
    expect(normalizeInboxPrefs({ collapse_nav_on_inbox: false }).collapse_nav_on_inbox).toBe(false);
    expect(normalizeInboxPrefs({}).collapse_nav_on_inbox).toBeUndefined();
  });
});

describe('resolveInboxPrefs', () => {
  it('ships an Outlook-shaped default: nav collapsed, newest message first', () => {
    const resolved = resolveInboxPrefs(null);
    expect(resolved.collapse_nav_on_inbox).toBe(true);
    expect(resolved.thread_order).toBe('newest_first');
    expect(resolved.reading_pane).toBe('right');
    expect(resolved.sort).toEqual({ field: 'date', direction: 'desc' });
  });

  it('lets a saved false override the default', () => {
    expect(resolveInboxPrefs({ collapse_nav_on_inbox: false }).collapse_nav_on_inbox).toBe(false);
    expect(resolveInboxPrefs({ thread_order: 'oldest_first' }).thread_order).toBe('oldest_first');
  });

  it('falls back per key, not all-or-nothing', () => {
    const resolved = resolveInboxPrefs({ density: 'compact' });
    expect(resolved.density).toBe('compact');
    expect(resolved.reading_pane).toBe(INBOX_PREFS_DEFAULTS.reading_pane);
  });
});

describe('mergeInboxPrefs', () => {
  it('keeps untouched keys and stamps the write clock', () => {
    const merged = mergeInboxPrefs({ density: 'compact' }, { thread_order: 'oldest_first' });
    expect(merged.density).toBe('compact');
    expect(merged.thread_order).toBe('oldest_first');
    expect(typeof merged.updated_at).toBe('number');
  });
});

describe('pickFresherInboxPrefs', () => {
  it('lets the newer write win so a stale tab cannot resurrect a layout', () => {
    const older = { density: 'compact' as const, updated_at: 1000 };
    const newer = { density: 'comfortable' as const, updated_at: 2000 };
    expect(pickFresherInboxPrefs(older, newer)).toBe(newer);
    expect(pickFresherInboxPrefs(newer, older)).toBe(newer);
  });

  it('treats an unstamped value as oldest', () => {
    const stamped = { density: 'compact' as const, updated_at: 5 };
    expect(pickFresherInboxPrefs({ density: 'cozy' }, stamped)).toBe(stamped);
  });
});

describe('togglePinned', () => {
  it('adds newest-first and removes on a second toggle', () => {
    expect(togglePinned([], 'a')).toEqual(['a']);
    expect(togglePinned(['a'], 'b')).toEqual(['b', 'a']);
    expect(togglePinned(['b', 'a'], 'a')).toEqual(['b']);
  });

  it('honours the cap', () => {
    const full = Array.from({ length: MAX_PINNED_CONVERSATIONS }, (_, i) => `c${i}`);
    expect(togglePinned(full, 'new')).toHaveLength(MAX_PINNED_CONVERSATIONS);
    expect(togglePinned(full, 'new')[0]).toBe('new');
  });
});

describe('toggleQuickFilter', () => {
  it('adds and removes', () => {
    expect(toggleQuickFilter([], 'unread')).toEqual(['unread']);
    expect(toggleQuickFilter(['unread'], 'flagged')).toEqual(['unread', 'flagged']);
    expect(toggleQuickFilter(['unread', 'flagged'], 'unread')).toEqual(['flagged']);
  });
});

describe('inboxPrefsStorageKey', () => {
  it('scopes the mirror by profile so a shared browser cannot cross layouts', () => {
    expect(inboxPrefsStorageKey('user-a')).not.toBe(inboxPrefsStorageKey('user-b'));
    expect(inboxPrefsStorageKey('user-a')).toContain('user-a');
  });
});
