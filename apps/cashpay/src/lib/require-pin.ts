import { NextResponse, type NextRequest } from 'next/server';
import {
  isPinUnlockCookieValid,
  PIN_COOKIE_NAME,
  PIN_COOKIE_NAME_LEGACY,
} from '@crm-eco/ui/lib/pin-lock';

/** Shared middleware leaves /api exempt. Cash Pay's tape is the product — fail closed. */
export function requirePinUnlock(request: NextRequest): NextResponse | null {
  const value =
    request.cookies.get(PIN_COOKIE_NAME)?.value ??
    request.cookies.get(PIN_COOKIE_NAME_LEGACY)?.value;
  if (isPinUnlockCookieValid(value)) return null;
  return NextResponse.json({ error: 'locked', message: 'Unlock required.' }, { status: 401 });
}
