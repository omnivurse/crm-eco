import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  decideDesktopAlert,
  readNotificationPrefs,
  writeNotificationPrefs,
  type NotificationPrefs,
  type PrefsStorage,
} from './notification-prefs';

function memoryStorage(initial?: Record<string, string>): PrefsStorage & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('readNotificationPrefs', () => {
  it('defaults to quiet so nothing alerts without consent', () => {
    expect(DEFAULT_NOTIFICATION_PREFS).toEqual({ desktop: false, sound: false });
    expect(readNotificationPrefs(memoryStorage())).toEqual({ desktop: false, sound: false });
  });

  it('returns defaults when storage is unavailable (SSR)', () => {
    expect(readNotificationPrefs(null)).toEqual({ desktop: false, sound: false });
    expect(readNotificationPrefs(undefined)).toEqual({ desktop: false, sound: false });
  });

  it('round-trips saved preferences', () => {
    const storage = memoryStorage();
    writeNotificationPrefs({ desktop: true, sound: true }, storage);
    expect(readNotificationPrefs(storage)).toEqual({ desktop: true, sound: true });
  });

  it('falls back to defaults on corrupt JSON rather than throwing', () => {
    const storage = memoryStorage({ 'crm.inbox.notifications': '{not json' });
    expect(readNotificationPrefs(storage)).toEqual({ desktop: false, sound: false });
  });

  it('coerces non-boolean values instead of trusting them', () => {
    const storage = memoryStorage({
      'crm.inbox.notifications': JSON.stringify({ desktop: 'yes', sound: 1 }),
    });
    expect(readNotificationPrefs(storage)).toEqual({ desktop: false, sound: false });
  });

  it('survives a storage that throws on read', () => {
    const throwing: PrefsStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };
    expect(readNotificationPrefs(throwing)).toEqual({ desktop: false, sound: false });
  });
});

describe('writeNotificationPrefs', () => {
  it('is a no-op without storage', () => {
    expect(() => writeNotificationPrefs({ desktop: true, sound: true }, null)).not.toThrow();
  });

  it('swallows quota errors from private browsing', () => {
    const throwing: PrefsStorage = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error('QuotaExceeded');
      }),
    };
    expect(() => writeNotificationPrefs({ desktop: true, sound: false }, throwing)).not.toThrow();
  });
});

describe('decideDesktopAlert', () => {
  const on: NotificationPrefs = { desktop: true, sound: false };

  it('shows an OS popup for a background tab once granted', () => {
    expect(decideDesktopAlert({ prefs: on, permission: 'granted', documentVisible: false })).toEqual({
      show: true,
    });
  });

  it('stays silent while the tab is focused, since the toast covers it', () => {
    expect(decideDesktopAlert({ prefs: on, permission: 'granted', documentVisible: true })).toEqual({
      show: false,
      reason: 'tab-focused',
    });
  });

  it('respects an opt-out', () => {
    expect(
      decideDesktopAlert({
        prefs: { desktop: false, sound: false },
        permission: 'granted',
        documentVisible: false,
      }),
    ).toEqual({ show: false, reason: 'disabled' });
  });

  it('does nothing when permission was denied or never asked', () => {
    expect(decideDesktopAlert({ prefs: on, permission: 'denied', documentVisible: false })).toEqual({
      show: false,
      reason: 'not-granted',
    });
    expect(decideDesktopAlert({ prefs: on, permission: 'default', documentVisible: false })).toEqual({
      show: false,
      reason: 'not-granted',
    });
  });

  it('handles browsers with no Notification API', () => {
    expect(decideDesktopAlert({ prefs: on, permission: null, documentVisible: false })).toEqual({
      show: false,
      reason: 'unsupported',
    });
  });
});
