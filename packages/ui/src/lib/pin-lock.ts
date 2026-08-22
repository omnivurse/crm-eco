/**
 * Shared PIN disguise gate — cookie + path policy.
 *
 * The overlay used to wait for client hydration, so the real landing page
 * painted first. Middleware now redirects to `/lock` before HTML ships.
 * Unlock is a cookie (readable at the edge) plus sessionStorage (legacy).
 */

export const PIN_LOCK_PATH = '/lock';
export const PIN_COOKIE_NAME = 'dh_pin_unlocked';
export const PIN_STORAGE_KEY = 'app-pin-unlocked';
export const PIN_EXPIRY_KEY = 'app-pin-expiry';
export const PIN_SESSION_HOURS = 12;
export const PIN_COOKIE_MAX_AGE_SEC = PIN_SESSION_HOURS * 60 * 60;
export const PIN_LOCK_PATH_HEADER = 'x-dh-pin-lock-path';

/** Default preview PIN when env is unset (client-side gate only). */
export const DEFAULT_SITE_PIN = '012049';

/** Misleading title shown on the lock page to deter casual discovery. */
export const SITE_PIN_GATE_TITLE = 'Lead Generation Quote System';

export const X_ROBOTS_TAG_NOINDEX = 'noindex, nofollow, noarchive, nosnippet';

/** Website paths left reachable without a PIN (banking / legal review). */
export const WEBSITE_PIN_PUBLIC_PATHS = ['/legal/privacy', '/legal/sms-privacy'] as const;

export const PIN_LOCK_ROBOTS_METADATA = {
  index: false,
  follow: false,
  nocache: true,
  noarchive: true,
  nosnippet: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
    noarchive: true,
    nosnippet: true,
  },
} as const;

export const PIN_LOCK_PAGE_METADATA = {
  title: { absolute: SITE_PIN_GATE_TITLE },
  description: 'Enter your access PIN to continue.',
  robots: PIN_LOCK_ROBOTS_METADATA,
  openGraph: {
    title: SITE_PIN_GATE_TITLE,
    description: 'Enter your access PIN to continue.',
    siteName: SITE_PIN_GATE_TITLE,
  },
  twitter: {
    card: 'summary' as const,
    title: SITE_PIN_GATE_TITLE,
    description: 'Enter your access PIN to continue.',
  },
} as const;

export function isPinLockEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_PIN_LOCK === 'true' ||
    process.env.VITE_ENABLE_PIN_LOCK === 'true'
  );
}

export function getSitePin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_PIN?.trim() || process.env.VITE_SITE_PIN?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_SITE_PIN;
}

export function isPinLockPath(pathname: string): boolean {
  return pathname === PIN_LOCK_PATH || pathname.startsWith(`${PIN_LOCK_PATH}/`);
}

export function pathHasFileExtension(pathname: string): boolean {
  const last = pathname.split('/').pop() ?? '';
  return last.includes('.');
}

export function isPinLockExemptPath(
  pathname: string,
  extraExemptPaths: readonly string[] = [],
): boolean {
  if (isPinLockPath(pathname)) return true;
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/auth/')) return true;
  if (pathname.startsWith('/.well-known/')) return true;
  if (pathHasFileExtension(pathname)) return true;
  return extraExemptPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isPinUnlockCookieValid(value: string | undefined | null, now = Date.now()): boolean {
  if (!value) return false;
  const expiry = Number.parseInt(value, 10);
  return Number.isFinite(expiry) && now < expiry;
}

export function pinUnlockExpiry(now = Date.now()): number {
  return now + PIN_COOKIE_MAX_AGE_SEC * 1000;
}

/**
 * Only same-origin relative paths. Rejects protocol-relative and lock loops.
 */
export function sanitizePinLockNext(raw: string | null | undefined): string {
  if (!raw) return '/';
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (isPinLockPath(value.split('?')[0] ?? value)) return '/';
  return value;
}

export function buildPinLockRedirectPath(nextPathAndSearch: string): string {
  const safe = sanitizePinLockNext(nextPathAndSearch);
  if (safe === '/') return PIN_LOCK_PATH;
  return `${PIN_LOCK_PATH}?next=${encodeURIComponent(safe)}`;
}

export type PinLockDecision =
  | { action: 'allow'; lockPath: boolean }
  | { action: 'redirect'; location: string };

export function evaluatePinLockRequest(args: {
  pathname: string;
  search?: string;
  cookieValue?: string | null;
  extraExemptPaths?: readonly string[];
  nextParam?: string | null;
}): PinLockDecision {
  const pathname = args.pathname || '/';
  const extra = args.extraExemptPaths ?? [];

  if (isPinLockPath(pathname)) {
    if (isPinUnlockCookieValid(args.cookieValue)) {
      return { action: 'redirect', location: sanitizePinLockNext(args.nextParam) };
    }
    return { action: 'allow', lockPath: true };
  }

  if (isPinLockExemptPath(pathname, extra)) {
    return { action: 'allow', lockPath: false };
  }

  if (isPinUnlockCookieValid(args.cookieValue)) {
    return { action: 'allow', lockPath: false };
  }

  const next = `${pathname}${args.search ?? ''}`;
  return { action: 'redirect', location: buildPinLockRedirectPath(next) };
}

export function applyNoIndexHeaders(headers: { set: (name: string, value: string) => void }): void {
  headers.set('X-Robots-Tag', X_ROBOTS_TAG_NOINDEX);
}

export function persistPinUnlock(expiry = pinUnlockExpiry()): void {
  try {
    sessionStorage.setItem(PIN_STORAGE_KEY, 'true');
    sessionStorage.setItem(PIN_EXPIRY_KEY, String(expiry));
  } catch {
    /* private mode */
  }
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PIN_COOKIE_NAME}=${expiry}; Path=/; Max-Age=${PIN_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  } catch {
    /* cookies blocked */
  }
}

export function readClientPinUnlockExpiry(): number | null {
  try {
    const raw = sessionStorage.getItem(PIN_EXPIRY_KEY);
    if (!raw) return null;
    const expiry = Number.parseInt(raw, 10);
    if (Number.isFinite(expiry) && Date.now() < expiry) return expiry;
  } catch {
    /* sessionStorage unavailable */
  }
  return null;
}

export function pinLockRobots(): {
  rules: { userAgent: string; disallow: string };
} {
  return {
    rules: { userAgent: '*', disallow: '/' },
  };
}
