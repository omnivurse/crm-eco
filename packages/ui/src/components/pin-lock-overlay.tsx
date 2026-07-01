'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

const PIN_STORAGE_KEY = 'app-pin-unlocked';
const PIN_EXPIRY_KEY = 'app-pin-expiry';
const SESSION_HOURS = 12;

interface PinLockOverlayProps {
  pin: string;
  appName?: string;
  /** When true, show the gate regardless of env (used by PIFH website only). */
  alwaysOn?: boolean;
}

/** Default preview PIN when env is unset (client-side gate only). */
export const DEFAULT_SITE_PIN = '012049';

/** Misleading title shown on every app’s PIN gate to deter casual discovery. */
export const SITE_PIN_GATE_TITLE = 'Lead Generation Quote System';

/**
 * Opt-in PIN gate for apps that set `NEXT_PUBLIC_ENABLE_PIN_LOCK=true`.
 * Prefer `LeadGenQuotePinGate` for the standard monorepo disguise gate.
 */
export function isPinLockEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_PIN_LOCK === 'true' ||
    process.env.VITE_ENABLE_PIN_LOCK === 'true'
  );
}

/** PIN from env (`NEXT_PUBLIC_SITE_PIN` / `VITE_SITE_PIN`) or default preview PIN. */
export function getSitePin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_PIN?.trim() ||
    process.env.VITE_SITE_PIN?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_SITE_PIN;
}

/** Drop-in gate for app root layouts. */
export function SitePinLockGate({
  appName = SITE_PIN_GATE_TITLE,
  alwaysOn = false,
}: {
  appName?: string;
  alwaysOn?: boolean;
}) {
  return <PinLockOverlay pin={getSitePin()} appName={appName} alwaysOn={alwaysOn} />;
}

/**
 * Standard monorepo PIN gate — always on, shared PIN, shared disguise title and styling.
 * Mount once in each app’s root layout.
 */
export function LeadGenQuotePinGate() {
  return <SitePinLockGate appName={SITE_PIN_GATE_TITLE} alwaysOn />;
}

/**
 * Full-screen PIN gate that blocks access until the correct PIN is entered.
 * Persists unlock state in sessionStorage for SESSION_HOURS hours.
 */
export function PinLockOverlay({
  pin,
  appName = SITE_PIN_GATE_TITLE,
  alwaysOn = false,
}: PinLockOverlayProps) {
  const pinLockEnabled = alwaysOn || isPinLockEnabled();
  const [locked, setLocked] = React.useState(true);
  const [entered, setEntered] = React.useState('');
  const [error, setError] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    setMounted(true);
    try {
      const expiry = sessionStorage.getItem(PIN_EXPIRY_KEY);
      if (expiry && Date.now() < parseInt(expiry, 10)) {
        setLocked(false);
      }
    } catch { /* sessionStorage unavailable */ }
  }, []);

  const handleUnlock = React.useCallback(() => {
    const expiryMs = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
    try {
      sessionStorage.setItem(PIN_STORAGE_KEY, 'true');
      sessionStorage.setItem(PIN_EXPIRY_KEY, String(expiryMs));
    } catch { /* sessionStorage unavailable */ }
    setLocked(false);
  }, []);

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

  if (!pinLockEnabled || !mounted || !locked) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#f4f5f7] px-4 font-sans">
      <div
        className="w-full max-w-md border border-[#d8dce3] bg-white px-8 py-10 shadow-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-lock-title"
      >
        <div className="mb-8 border-b border-[#e8eaed] pb-6">
          <h1
            id="pin-lock-title"
            className="text-[15px] font-semibold tracking-wide text-[#1a1f26] uppercase"
          >
            {appName}
          </h1>
          <p className="mt-2 text-sm text-[#5f6773]">
            Enter your access PIN to continue.
          </p>
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

        <p className="mt-8 text-center text-xs text-[#8b939e]">
          Authorized personnel only.
        </p>
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
