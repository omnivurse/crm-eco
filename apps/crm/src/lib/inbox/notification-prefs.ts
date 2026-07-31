/**
 * Per-device preferences for new-mail alerts.
 *
 * Device-local rather than server-stored on purpose: "play a sound" and "show
 * a desktop popup" are properties of where you are sitting, not of who you
 * are. An agent on a shared floor wants sound off on the floor machine and on
 * at home, and OS notification permission is per-browser anyway — syncing the
 * preference would just let one device promise something another cannot do.
 *
 * In-app toasts are intentionally not optional here: they are the baseline
 * that makes the inbox live, and the whole point of the feature.
 */

const STORAGE_KEY = 'crm.inbox.notifications';

export interface NotificationPrefs {
  /** OS-level notification when the tab is not focused. */
  desktop: boolean;
  /** Short audible chime. */
  sound: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  // Both default off: a popup or a noise the user never asked for is an
  // intrusion, and browsers penalise unprompted permission requests.
  desktop: false,
  sound: false,
};

/** Minimal storage surface so tests need no browser. */
export interface PrefsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readNotificationPrefs(storage?: PrefsStorage | null): NotificationPrefs {
  if (!storage) return { ...DEFAULT_NOTIFICATION_PREFS };

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_NOTIFICATION_PREFS };
    return {
      desktop: parsed.desktop === true,
      sound: parsed.sound === true,
    };
  } catch {
    // Corrupt or unavailable storage must never break the inbox; fall back to
    // the quiet defaults.
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export function writeNotificationPrefs(
  prefs: NotificationPrefs,
  storage?: PrefsStorage | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ desktop: prefs.desktop, sound: prefs.sound }));
  } catch {
    // Private-browsing quota errors are not worth surfacing.
  }
}

export type DesktopAlertDecision =
  | { show: true }
  | { show: false; reason: 'disabled' | 'unsupported' | 'not-granted' | 'tab-focused' };

/**
 * Whether to raise an OS notification for this event.
 *
 * A desktop popup is suppressed while the tab is focused because the in-app
 * toast already covers that case, and two simultaneous alerts for one email
 * reads as a bug.
 */
export function decideDesktopAlert(input: {
  prefs: NotificationPrefs;
  permission: NotificationPermission | null;
  documentVisible: boolean;
}): DesktopAlertDecision {
  if (!input.prefs.desktop) return { show: false, reason: 'disabled' };
  if (input.permission === null) return { show: false, reason: 'unsupported' };
  if (input.permission !== 'granted') return { show: false, reason: 'not-granted' };
  if (input.documentVisible) return { show: false, reason: 'tab-focused' };
  return { show: true };
}
