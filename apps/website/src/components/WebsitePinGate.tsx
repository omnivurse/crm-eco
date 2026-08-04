'use client';

import { usePathname } from 'next/navigation';
import { SitePinLockGate } from '@crm-eco/ui/components/pin-lock-overlay';

/**
 * Paths left public for legal / banking review while the rest of the
 * marketing site stays behind the shared PIN gate.
 */
const PUBLIC_PATHS = ['/legal/privacy', '/legal/sms-privacy'] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function WebsitePinGate() {
  const pathname = usePathname();

  if (isPublicPath(pathname)) {
    return null;
  }

  return <SitePinLockGate alwaysOn />;
}
