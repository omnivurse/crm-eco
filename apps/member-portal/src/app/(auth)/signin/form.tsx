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
import { AuthFormHeader, authForm } from '@crm-eco/ui';

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
  const [mounted, setMounted] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div
      className={`space-y-8 transition-all duration-500 ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <AuthFormHeader
        title="Welcome back"
        subtitle="Sign in to your member account to continue."
      />

      <form onSubmit={handleSignIn} className="space-y-6">
        {error && (
          <div className={`${authForm.error} flex items-start gap-3`}>
            <WarningCircle weight="light" className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {isLockedOut && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-sm text-amber-200">
            <Lock weight="light" className="h-4 w-4 flex-shrink-0" />
            <span>
              Account temporarily locked. Try again in{' '}
              <span className="font-semibold tabular-nums">{lockoutSeconds}s</span>
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="signin-email" className={authForm.label}>Email address</label>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Envelope weight="light" className={authForm.inputIcon} />
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={isLockedOut}
                className={`${authForm.input} disabled:opacity-50`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="signin-password" className={authForm.label}>Password</label>
              <Link href="/reset-password" className={authForm.link}>Forgot password?</Link>
            </div>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Lock weight="light" className={authForm.inputIcon} />
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={isLockedOut}
                className={`${authForm.input} pr-12 disabled:opacity-50`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeSlash weight="light" className="h-5 w-5" />
                ) : (
                  <Eye weight="light" className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <button type="submit" className={authForm.submitBtn} disabled={loading || isLockedOut}>
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <CircleNotch weight="light" className="h-5 w-5 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Sign in
              <ArrowRight weight="light" className="h-4 w-4" />
            </span>
          )}
        </button>

        <div className="border-t border-slate-700 pt-4 text-center">
          <p className="text-sm text-slate-400">
            Are you an agent?{' '}
            <Link href="/signup" className="font-medium text-[#5ec8d8] transition-colors hover:text-[#7dd3e0]">
              Register here
            </Link>
          </p>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle weight="light" className="h-3 w-3 text-[#5ec8d8]" />
            <span>SSL Secured</span>
          </div>
          <div className="h-1 w-1 rounded-full bg-slate-600" />
          <div className="flex items-center gap-1.5">
            <Shield weight="light" className="h-3 w-3 text-[#5ec8d8]" />
            <span>HIPAA Compliant</span>
          </div>
          <div className="h-1 w-1 rounded-full bg-slate-600" />
          <div className="flex items-center gap-1.5">
            <Lock weight="light" className="h-3 w-3 text-[#5ec8d8]" />
            <span>Encrypted</span>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500">
          By signing in you agree to our{' '}
          <a href={`${LEGAL_BASE}/legal/terms`} className="text-[#5ec8d8] hover:underline" target="_blank" rel="noopener noreferrer">Terms</a>
          {', '}
          <a href={`${LEGAL_BASE}/legal/privacy`} className="text-[#5ec8d8] hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          {', and '}
          <Link href="/legal/sms-privacy" className="text-[#5ec8d8] hover:underline">
            SMS Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
