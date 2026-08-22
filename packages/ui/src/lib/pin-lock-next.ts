import { NextResponse, type NextRequest } from 'next/server';
import {
  applyNoIndexHeaders,
  evaluatePinLockRequest,
  PIN_COOKIE_NAME,
  PIN_COOKIE_NAME_LEGACY,
  PIN_LOCK_PATH,
  PIN_LOCK_PATH_HEADER,
  PIN_NEXT_COOKIE,
  sanitizePinLockNext,
} from './pin-lock';

const PIN_NEXT_MAX_AGE_SEC = 10 * 60;

function readPinUnlockCookie(request: NextRequest): string | undefined {
  return (
    request.cookies.get(PIN_COOKIE_NAME)?.value ??
    request.cookies.get(PIN_COOKIE_NAME_LEGACY)?.value
  );
}

function applyStealthHeaders(hdrs: Headers): void {
  applyNoIndexHeaders(hdrs);
  hdrs.set('Referrer-Policy', 'no-referrer');
  hdrs.set('X-Content-Type-Options', 'nosniff');
  hdrs.set('Cache-Control', 'no-store, no-cache, must-revalidate');
}

/**
 * Edge PIN gate. Call first in each app middleware.
 * Returns a response when this request is fully handled (redirect or /lock).
 * Returns null when the request may continue to auth / app logic.
 */
export function enforcePinLock(
  request: NextRequest,
  extraExemptPaths: readonly string[] = [],
): NextResponse | null {
  const decision = evaluatePinLockRequest({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    cookieValue: readPinUnlockCookie(request),
    extraExemptPaths,
    nextParam:
      request.nextUrl.searchParams.get('next') ?? request.cookies.get(PIN_NEXT_COOKIE)?.value,
  });

  if (decision.action === 'redirect') {
    const res = NextResponse.redirect(new URL(decision.location, request.url));
    applyStealthHeaders(res.headers);
    if (decision.location === PIN_LOCK_PATH && decision.next && decision.next !== '/') {
      res.cookies.set(PIN_NEXT_COOKIE, sanitizePinLockNext(decision.next), {
        path: '/',
        maxAge: PIN_NEXT_MAX_AGE_SEC,
        sameSite: 'lax',
        httpOnly: false,
        secure: request.nextUrl.protocol === 'https:',
      });
    }
    return res;
  }

  if (decision.lockPath) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(PIN_LOCK_PATH_HEADER, '1');
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    applyStealthHeaders(res.headers);
    return res;
  }

  return null;
}

export function withNoIndex(response: NextResponse): NextResponse {
  applyNoIndexHeaders(response.headers);
  return response;
}
