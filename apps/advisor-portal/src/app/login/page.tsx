'use client';

/**
 * Advisor Portal — sign in.
 *
 * VISUAL REDESIGN ONLY. Nothing about how this page authenticates changed:
 * the `createClient()` call, `signInWithPassword`, the `redirect` search
 * param defaulting to `/dashboard`, the `no_advisor_access` error mapping,
 * `router.push` + `router.refresh()`, both field ids, both `autoComplete`
 * values, `required`, and every string of copy are byte-for-byte what they
 * were. The diff is the shell (`variant="advisor"`), the token-driven class
 * map, and three accessibility fixes noted inline.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CircleNotch,
  Envelope,
  Eye,
  EyeSlash,
  Lock,
} from '@phosphor-icons/react';
import { AuthFormError, BrandLogo, authForm } from '@crm-eco/ui';
import { AdvisorAuthShell } from '@/components/auth/AdvisorAuthShell';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const errorParam = searchParams.get('error');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  const displayError =
    error || (errorParam === 'no_advisor_access' ? 'You do not have advisor access.' : errorParam ? 'An error occurred.' : null);

  return (
    <div className="space-y-8">
      <div className="text-center lg:text-left">
        {/* tone was "white", which resolved to /logo-white.png — an asset this
            app does not ship. The mark was a broken image on every sign-in.
            "color" uses the /logo.png that is actually here. */}
        <Link href="/" className="mb-6 inline-flex items-center">
          <BrandLogo
            variant="full"
            size="md"
            tone="color"
            priority
            className="lg:h-14"
          />
        </Link>
        <h2 className={authForm.title}>Advisor Portal</h2>
        <p className={authForm.subtitle}>Sign in to access your dashboard</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {/* Was a bare <div>: the failure appeared silently and a screen reader
            never announced it. Same box, now role="alert". Text untouched. */}
        {displayError && <AuthFormError>{displayError}</AuthFormError>}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className={authForm.label}>Email Address</label>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Envelope weight="light" className={authForm.inputIcon} aria-hidden="true" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                className={authForm.input}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={authForm.label}>Password</label>
              <Link href="/reset-password" className={authForm.link}>Forgot password?</Link>
            </div>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Lock weight="light" className={authForm.inputIcon} aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className={`${authForm.input} pr-14`}
              />
              {/* Was a ~20px unlabelled target painted `hover:text-slate-300`
                  — lighter on hover, on a light panel. `authForm.fieldAffix`
                  is 44x44 and tone-aware; the aria-label is new, nothing was
                  removed. It stays in the tab order deliberately: revealing
                  the password is something a keyboard user needs to reach. */}
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

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className={authForm.submitBtn}
        >
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <CircleNotch weight="light" className="h-5 w-5 animate-spin" aria-hidden="true" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Sign In
              <ArrowRight weight="light" className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </button>
      </form>

      <p className={authForm.footer}>
        Need help? Contact your administrator
        {' · '}
        <Link href="/legal/sms-privacy" className={authForm.link}>
          SMS Privacy
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AdvisorAuthShell>
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center py-16"
            role="status"
            aria-live="polite"
          >
            <CircleNotch
              weight="light"
              className="h-8 w-8 animate-spin text-[var(--auth-tone)]"
              aria-hidden="true"
            />
            <span className="sr-only">Loading sign in</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AdvisorAuthShell>
  );
}
