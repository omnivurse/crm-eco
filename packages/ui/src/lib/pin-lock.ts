/**
 * Shared PIN disguise gate — cookie + path policy.
 *
 * The overlay used to wait for client hydration, so the real landing page
 * painted first. Middleware now redirects to `/lock` before HTML ships.
 * Unlock is a cookie (readable at the edge) plus sessionStorage (legacy).
 */

export const PIN_LOCK_PATH = '/lock';
/** Neutral cookie — do not use product / org prefixes. */
export const PIN_COOKIE_NAME = 'lgq_ok';
/** Previous name; still accepted so existing unlock sessions survive one deploy. */
export const PIN_COOKIE_NAME_LEGACY = 'dh_pin_unlocked';
/** Destination after unlock. Kept off the URL so `/crm-login` never appears in the bar. */
export const PIN_NEXT_COOKIE = 'lgq_next';
export const PIN_STORAGE_KEY = 'app-pin-unlocked';
export const PIN_EXPIRY_KEY = 'app-pin-expiry';
export const PIN_SESSION_HOURS = 12;
export const PIN_COOKIE_MAX_AGE_SEC = PIN_SESSION_HOURS * 60 * 60;
export const PIN_LOCK_PATH_HEADER = 'x-pin-lock-path';
export const PIN_LOCK_PATH_HEADER_LEGACY = 'x-dh-pin-lock-path';

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
  applicationName: SITE_PIN_GATE_TITLE,
  keywords: [] as string[],
  robots: PIN_LOCK_ROBOTS_METADATA,
  appleWebApp: {
    capable: false,
    title: SITE_PIN_GATE_TITLE,
  },
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
};

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

export function buildPinLockRedirectPath(): string {
  return PIN_LOCK_PATH;
}

export type PinLockDecision =
  | { action: 'allow'; lockPath: boolean }
  | { action: 'redirect'; location: string; next?: string };

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

  return {
    action: 'redirect',
    location: PIN_LOCK_PATH,
    next: sanitizePinLockNext(`${pathname}${args.search ?? ''}`),
  };
}

export function headersIndicatePinLock(getHeader: (name: string) => string | null): boolean {
  return getHeader(PIN_LOCK_PATH_HEADER) === '1' || getHeader(PIN_LOCK_PATH_HEADER_LEGACY) === '1';
}

export function readDocumentCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export function readPinNextTarget(explicit?: string | null): string {
  const fromQuery =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
  return sanitizePinLockNext(explicit || readDocumentCookie(PIN_NEXT_COOKIE) || fromQuery);
}

export function clearPinNextCookie(): void {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${PIN_NEXT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** Mute browser console on the public lock surface only. */
export function silencePublicConsole(): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'production') return;
  const noop = () => undefined;
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
  console.error = noop;
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
    document.cookie = `${PIN_COOKIE_NAME_LEGACY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
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
