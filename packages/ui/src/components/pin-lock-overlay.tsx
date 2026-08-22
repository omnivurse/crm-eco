'use client';

import * as React from 'react';
import {
  getSitePin,
  isPinLockEnabled,
  persistPinUnlock,
  readClientPinUnlockExpiry,
  SITE_PIN_GATE_TITLE,
} from '../lib/pin-lock';
import { PinLockPage, PinLockScreen } from './pin-lock-page';

export { PinLockPage, PinLockScreen };

/** Drop-in gate for app root layouts. Prefer the /lock route + middleware. */
export function SitePinLockGate({
  appName = SITE_PIN_GATE_TITLE,
  alwaysOn = false,
}: {
  appName?: string;
  alwaysOn?: boolean;
}) {
  return <PinLockOverlay pin={getSitePin()} appName={appName} alwaysOn={alwaysOn} />;
}

export function LeadGenQuotePinGate() {
  return <SitePinLockGate appName={SITE_PIN_GATE_TITLE} alwaysOn />;
}

/**
 * Overlay fallback. SSR-visible (no mounted gate) so it cannot flash the
 * landing page if a layout still mounts it. Middleware + /lock is the real gate.
 */
export function PinLockOverlay({
  pin,
  appName = SITE_PIN_GATE_TITLE,
  alwaysOn = false,
}: {
  pin: string;
  appName?: string;
  alwaysOn?: boolean;
}) {
  const pinLockEnabled = alwaysOn || isPinLockEnabled();
  const [locked, setLocked] = React.useState(true);

  React.useEffect(() => {
    const expiry = readClientPinUnlockExpiry();
    if (expiry) {
      persistPinUnlock(expiry);
      setLocked(false);
    }
  }, []);

  if (!pinLockEnabled || !locked) return null;

  return (
    <div className="fixed inset-0 z-[99999]">
      <PinLockScreen pin={pin} appName={appName} onUnlock={() => setLocked(false)} />
    </div>
  );
}
