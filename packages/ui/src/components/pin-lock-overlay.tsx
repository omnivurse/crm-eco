'use client';

import * as React from 'react';

const PIN_STORAGE_KEY = 'app-pin-unlocked';
const PIN_EXPIRY_KEY = 'app-pin-expiry';
const SESSION_HOURS = 12;

interface PinLockOverlayProps {
  pin: string;
  appName?: string;
}

/**
 * Full-screen PIN gate that blocks access until the correct PIN is entered.
 * Persists unlock state in sessionStorage for SESSION_HOURS hours.
 */
export function PinLockOverlay({ pin, appName = 'Application' }: PinLockOverlayProps) {
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
    [entered, pin, handleUnlock]
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
    [entered]
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
    [pin, handleUnlock]
  );

  if (!mounted || !locked) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-sans"
    >
      <div
        className="flex flex-col items-center gap-8 py-12 px-10 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl max-w-[400px] w-[90vw]"
      >
        {/* Lock icon */}
        <div
          className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)]"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-slate-50 text-2xl font-bold mb-2 tracking-tight">
            {appName}
          </h1>
          <p className="text-slate-400 text-sm">
            Enter PIN to continue
          </p>
        </div>

        {/* PIN input boxes */}
        <div className="flex gap-3">
          {Array.from({ length: pin.length }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={entered[i] || ''}
              autoFocus={i === 0}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (val) handleDigit(val[val.length - 1], i);
              }}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={i === 0 ? handlePaste : undefined}
              className="w-12 h-14 text-center text-2xl font-bold rounded-xl bg-white/[0.08] text-slate-50 outline-none transition-all caret-blue-500"
              style={{
                border: error
                  ? '2px solid #ef4444'
                  : entered[i]
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                animation: error ? 'pin-shake 0.4s ease' : undefined,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
              }}
              onBlur={(e) => {
                if (!entered[i]) {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }
                e.target.style.boxShadow = 'none';
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm -mt-2 font-medium">
            Incorrect PIN
          </p>
        )}

        <p className="text-slate-600 text-xs text-center">
          Authorized Access Only
        </p>
      </div>

      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
