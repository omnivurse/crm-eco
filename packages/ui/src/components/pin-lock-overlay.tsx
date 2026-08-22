'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import {
  getSitePin,
  isPinLockEnabled,
  persistPinUnlock,
  readClientPinUnlockExpiry,
  sanitizePinLockNext,
  SITE_PIN_GATE_TITLE,
} from '../lib/pin-lock';

export { DEFAULT_SITE_PIN, getSitePin, isPinLockEnabled, SITE_PIN_GATE_TITLE } from '../lib/pin-lock';

interface PinLockOverlayProps {
  pin: string;
  appName?: string;
  /** When true, show the gate regardless of env (used by PIFH website only). */
  alwaysOn?: boolean;
}

interface PinLockScreenProps {
  pin: string;
  appName: string;
  onUnlock: () => void;
}

function PinLockScreen({ pin, appName, onUnlock }: PinLockScreenProps) {
  const [entered, setEntered] = React.useState('');
  const [error, setError] = React.useState(false);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleUnlock = React.useCallback(() => {
    persistPinUnlock();
    onUnlock();
  }, [onUnlock]);

  const handleDigit = React.useCallback(
    (digit: string, index: number) => {
      setError(false);
      const next = entered.substring(0, index) + digit + entered.substring(index + 1);
      setEntered(next);

      if (index < pin.length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (next.length === pin.length) {
        const complete = next.substring(0, pin.length);
        if (complete === pin) {
          handleUnlock();
        } else {
          setError(true);
          setTimeout(() => {
            setEntered('');
            setError(false);
            inputRefs.current[0]?.focus();
          }, 600);
        }
      }
    },
    [entered, pin, handleUnlock],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        setError(false);
        const next = entered.substring(0, index) + '' + entered.substring(index + 1);
        setEntered(next.trimEnd());
        if (index > 0) {
          inputRefs.current[index - 1]?.focus();
        }
      }
    },
    [entered],
  );

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, pin.length);
      setEntered(pasted);
      if (pasted === pin) {
        handleUnlock();
      } else if (pasted.length === pin.length) {
        setError(true);
        setTimeout(() => {
          setEntered('');
          setError(false);
          inputRefs.current[0]?.focus();
        }, 600);
      } else {
        inputRefs.current[Math.min(pasted.length, pin.length - 1)]?.focus();
      }
    },
    [pin, handleUnlock],
  );

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f4f5f7] px-4 font-sans">
      <div
        className="w-full max-w-md border border-[#d8dce3] bg-white px-8 py-10 shadow-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-lock-title"
      >
        <div className="mb-8 border-b border-[#e8eaed] pb-6">
          <h1
            id="pin-lock-title"
            className="text-[15px] font-semibold uppercase tracking-wide text-[#1a1f26]"
          >
            {appName}
          </h1>
          <p className="mt-2 text-sm text-[#5f6773]">Enter your access PIN to continue.</p>
        </div>

        <div className="mb-2">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#8b939e]">
            Access PIN
          </p>
          <div className="flex justify-center gap-2">
            {Array.from({ length: pin.length }).map((_, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={entered[i] || ''}
                autoFocus={i === 0}
                aria-label={`PIN digit ${i + 1} of ${pin.length}`}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val) handleDigit(val[val.length - 1], i);
                }}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onPaste={i === 0 ? handlePaste : undefined}
                className={cn(
                  'h-11 w-10 border bg-white text-center text-lg font-medium text-[#1a1f26] outline-none transition-colors',
                  'focus:border-[#1a1f26] focus:ring-1 focus:ring-[#1a1f26]',
                  error
                    ? 'border-red-600 animate-[pin-shake_0.4s_ease]'
                    : entered[i]
                      ? 'border-[#1a1f26]'
                      : 'border-[#c5cad3]',
                )}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-center text-sm text-red-700" role="alert">
            Incorrect PIN. Please try again.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-[#8b939e]">Authorized personnel only.</p>
      </div>

      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

/** Dedicated /lock page — this is the HTML that ships before unlock. */
export function PinLockPage({
  next = '/',
  appName = SITE_PIN_GATE_TITLE,
}: {
  next?: string;
  appName?: string;
}) {
  const destination = sanitizePinLockNext(next);
  const pin = getSitePin();

  React.useEffect(() => {
    const expiry = readClientPinUnlockExpiry();
    if (!expiry) return;
    persistPinUnlock(expiry);
    window.location.replace(destination);
  }, [destination]);

  return (
    <PinLockScreen
      pin={pin}
      appName={appName}
      onUnlock={() => {
        window.location.replace(destination);
      }}
    />
  );
}

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
}: PinLockOverlayProps) {
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
