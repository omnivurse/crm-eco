import { toastCopy } from '@/lib/crm/toast-copy';

export type AnalyticsFetchOk<T> = { ok: true; data: T };
export type AnalyticsFetchSession = {
  ok: false;
  reason: 'session';
  href: string;
  title: string;
  description: string;
  actionLabel: string;
};
export type AnalyticsFetchError = { ok: false; reason: 'error' };
export type AnalyticsFetchResult<T> =
  | AnalyticsFetchOk<T>
  | AnalyticsFetchSession
  | AnalyticsFetchError;

/**
 * Same-origin analytics GET. Distinguishes expired session (401) from
 * a real load failure so the tab can send the user back to login
 * instead of a generic "Failed to load" dead-end.
 */
export async function fetchAnalyticsJson<T>(
  url: string,
  returnPath: string,
): Promise<AnalyticsFetchResult<T>> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 401) {
      const expired = toastCopy.sessionExpired(returnPath);
      return {
        ok: false,
        reason: 'session',
        href: expired.href,
        title: expired.title,
        description: expired.description,
        actionLabel: expired.actionLabel,
      };
    }
    if (!res.ok) return { ok: false, reason: 'error' };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
