'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Envelope,
  Lock,
  Eye,
  EyeSlash,
  ArrowRight,
  CircleNotch,
  Shield,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { AuthFormHeader, AuthFormError, authForm } from '@crm-eco/ui';

/**
 * VISUAL REDESIGN ONLY.
 *
 * Not one line of authentication behaviour changed. The lockout threshold and
 * duration, the countdown, `signInWithPassword`, the email normalisation, the
 * profile/advisor lookup, the inactive-agent sign-out, both `window.location`
 * destinations, the `redirect` param handling, every error string and the
 * legal copy are byte-for-byte what they were. The diff is classes, tokens,
 * touch targets, and three accessibility fixes:
 *
 *   1. the error box is now `AuthFormError` (role="alert"), so a screen reader
 *      is told the sign-in failed — before, the message appeared in silence;
 *   2. the show/hide password control was a ~20px tap target floating in the
 *      field; `authForm.fieldAffix` makes it 44x44 with a focus ring;
 *   3. the mount fade is gone. It held the whole form at `opacity-0` until
 *      hydration, which on a slow phone is a blank panel for a member who is
 *      already anxious. Nothing else depended on that state.
 *
 * The lockout panel is deliberately NOT a live region: the countdown ticks
 * every second, and a polite live region would read "59… 58… 57…" over the
 * member. The alert that opens the lockout is announced once, by (1).
 */

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 60_000;

const LEGAL_BASE = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://doublehelixhub.com';

export function SignInForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    if (!lockoutUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutSeconds(0);
        setFailedAttempts(0);
        setError(null);
      } else {
        setLockoutSeconds(remaining);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const getErrorMessage = (msg: string): string => {
    if (msg.includes('Invalid login credentials')) {
      const remaining = LOCKOUT_THRESHOLD - (failedAttempts + 1);
      if (remaining > 0) {
        return `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout.`;
      }
      return 'Invalid email or password.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Please check your email and confirm your account before signing in.';
    }
    if (msg.includes('Too many requests')) {
      return 'Too many sign-in attempts. Please wait a moment and try again.';
    }
    return msg;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= LOCKOUT_THRESHOLD) {
          setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
          setError('Too many failed attempts. Please wait 60 seconds before trying again.');
        } else {
          setError(getErrorMessage(signInError.message));
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        setFailedAttempts(0);

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('user_id', data.user.id)
          .single() as { data: { id: string; role: string } | null };

        let advisor = null;
        if (profile && profile.role === 'advisor') {
          const { data: advisorData } = await supabase
            .from('advisors')
            .select('id, status')
            .eq('profile_id', profile.id)
            .single() as { data: { id: string; status: string } | null };
          advisor = advisorData;
        }

        if (advisor) {
          if (advisor.status !== 'active') {
            setError('Your agent account is not active. Please contact support.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
          window.location.assign('/agent');
        } else {
          const destination = redirectTo.startsWith('/') ? redirectTo : '/';
          window.location.assign(destination);
        }
        return;
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <AuthFormHeader
        title="Welcome back"
        subtitle="Sign in to your member account to continue."
      />

      <form onSubmit={handleSignIn} className="space-y-6">
        {error && (
          <AuthFormError>
            <WarningCircle weight="light" className="auth-alert-icon" aria-hidden="true" />
            <span>{error}</span>
          </AuthFormError>
        )}

        {isLockedOut && (
          <div className="mp-lock">
            <Lock weight="light" className="mp-lock-icon" aria-hidden="true" />
            <span>
              Account temporarily locked. Try again in{' '}
              <span className="mp-lock-count">{lockoutSeconds}s</span>
            </span>
          </div>
        )}

        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="signin-email" className={authForm.label}>Email address</label>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Envelope weight="light" className={authForm.inputIcon} aria-hidden="true" />
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={isLockedOut}
                className={authForm.input}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              <label htmlFor="signin-password" className={authForm.label}>Password</label>
              <Link href="/reset-password" className={authForm.link}>Forgot password?</Link>
            </div>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Lock weight="light" className={authForm.inputIcon} aria-hidden="true" />
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={isLockedOut}
                className={`${authForm.input} pr-14`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={authForm.fieldAffix}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeSlash weight="light" className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye weight="light" className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        <button type="submit" className={authForm.submitBtn} disabled={loading || isLockedOut}>
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <CircleNotch weight="light" className="h-5 w-5 animate-spin" aria-hidden="true" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Sign in
              <ArrowRight weight="light" className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </button>

        <div className="mp-rule">
          <p className="mp-rule-text">
            Are you an agent?{' '}
            <Link href="/signup" className="mp-link">
              Register here
            </Link>
          </p>
        </div>
      </form>

      <div className="space-y-3">
        <ul className="mp-assure">
          <li className="mp-assure-item">
            <CheckCircle weight="light" className="mp-assure-icon" aria-hidden="true" />
            <span>SSL Secured</span>
          </li>
          <li className="mp-assure-sep" aria-hidden="true" />
          <li className="mp-assure-item">
            <Shield weight="light" className="mp-assure-icon" aria-hidden="true" />
            <span>HIPAA Compliant</span>
          </li>
          <li className="mp-assure-sep" aria-hidden="true" />
          <li className="mp-assure-item">
            <Lock weight="light" className="mp-assure-icon" aria-hidden="true" />
            <span>Encrypted</span>
          </li>
        </ul>
        <p className={authForm.footer}>
          By signing in you agree to our{' '}
          <a href={`${LEGAL_BASE}/legal/terms`} className="mp-link" target="_blank" rel="noopener noreferrer">Terms</a>
          {', '}
          <a href={`${LEGAL_BASE}/legal/privacy`} className="mp-link" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          {', and '}
          <Link href="/legal/sms-privacy" className="mp-link">
            SMS Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
