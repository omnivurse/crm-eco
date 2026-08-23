import { NextResponse, type NextRequest } from 'next/server';
import { enforcePinLock, withNoIndex } from '@crm-eco/ui/lib/pin-lock-next';

export function middleware(request: NextRequest) {
  const pin = enforcePinLock(request);
  if (pin) return pin;
  return withNoIndex(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|css|map|webmanifest|woff|woff2|txt|xml)$).*)',
  ],
};
