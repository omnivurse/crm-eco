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
    } catch {}
  }, []);

  const handleUnlock = React.useCallback(() => {
    const expiryMs = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
    try {
      sessionStorage.setItem(PIN_STORAGE_KEY, 'true');
      sessionStorage.setItem(PIN_EXPIRY_KEY, String(expiryMs));
    } catch {}
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
          padding: '3rem 2.5rem',
          borderRadius: '1.5rem',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          maxWidth: '400px',
          width: '90vw',
        }}
      >
        {/* Lock icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              color: '#f8fafc',
              fontSize: '1.5rem',
              fontWeight: 700,
              margin: '0 0 0.5rem 0',
              letterSpacing: '-0.025em',
            }}
          >
            {appName}
          </h1>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.875rem',
              margin: 0,
            }}
          >
            Enter PIN to continue
          </p>
        </div>

        {/* PIN input boxes */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
          }}
        >
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
              style={{
                width: '48px',
                height: '56px',
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                borderRadius: '0.75rem',
                border: error
                  ? '2px solid #ef4444'
                  : entered[i]
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                outline: 'none',
                transition: 'all 0.15s ease',
                caretColor: '#3b82f6',
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
          <p
            style={{
              color: '#ef4444',
              fontSize: '0.875rem',
              margin: '-0.5rem 0 0 0',
              fontWeight: 500,
            }}
          >
            Incorrect PIN
          </p>
        )}

        <p
          style={{
            color: '#475569',
            fontSize: '0.75rem',
            margin: 0,
            textAlign: 'center',
          }}
        >
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
