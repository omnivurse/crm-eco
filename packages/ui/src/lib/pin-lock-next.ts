import { NextResponse, type NextRequest } from 'next/server';
import {
  applyNoIndexHeaders,
  evaluatePinLockRequest,
  PIN_COOKIE_NAME,
  PIN_LOCK_PATH_HEADER,
} from './pin-lock';

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
    cookieValue: request.cookies.get(PIN_COOKIE_NAME)?.value,
    extraExemptPaths,
    nextParam: request.nextUrl.searchParams.get('next'),
  });

  if (decision.action === 'redirect') {
    const res = NextResponse.redirect(new URL(decision.location, request.url));
    applyNoIndexHeaders(res.headers);
    return res;
  }

  if (decision.lockPath) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(PIN_LOCK_PATH_HEADER, '1');
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    applyNoIndexHeaders(res.headers);
    return res;
  }

  return null;
}

export function withNoIndex(response: NextResponse): NextResponse {
  applyNoIndexHeaders(response.headers);
  return response;
}
