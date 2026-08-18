'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { BrandLogo, authForm, AuthFormError } from '@crm-eco/ui';
import {
  ShieldCheck,
  Pulse,
  FirstAidKit,
  CircleNotch,
  Lock,
  Eye,
  EyeSlash,
  EnvelopeSimple,
  Square,
} from '@phosphor-icons/react';
import styles from '../admin-auth.module.css';

/**
 * MMS sign-in.
 *
 * VISUAL REDESIGN ONLY. Everything below the render is byte-identical to the
 * shipped version: the browser client, `signInWithPassword`, the profile
 * lookup, the `['owner','super_admin','admin','staff']` role gate and its two
 * `signOut()` calls, `logAuthEvent`, the `?error=config` effect, the
 * `/dashboard` push + refresh, every field name, every error string.
 *
 * The diff is paint and accessibility:
 *  - hand-rolled eyebrow  -> `authForm.eyebrow` (mono, tone-coloured)
 *  - error <div>          -> <AuthFormError> (role="alert" — the failure was
 *                            never announced to a screen reader)
 *  - show/hide password   -> `authForm.fieldAffix`, a real 44px target with a
 *                            name (it was a ~20px unlabelled icon)
 *  - remember me          -> one 44px labelled control with role="checkbox"
 *                            (it was a 20px unnamed button next to a <label>
 *                            bound to nothing)
 *  - trust chips          -> token-driven; `emerald-500/10` and `cyan-500/10`
 *                            did not paint the brand, because the console
 *                            remaps those Tailwind scales.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'config') {
      setError(
        'Server configuration incomplete. Add Supabase URL/anon key to apps/admin/.env.local and restart.',
      );
    }
  }, []);

  const logAuthEvent = async (action: string, details?: Record<string, unknown>) => {
    try {
      await fetch('/api/auth/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email, details }),
      });
    } catch (err) {
      console.error('Failed to log auth event:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        await logAuthEvent('login_failed', { reason: signInError.message });
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        if (profileError || !profile) {
          await logAuthEvent('login_failed', {
            reason: 'No profile found',
            profileError: profileError?.message,
          });
          setError('No profile found. Please contact your administrator.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        if (!['owner', 'super_admin', 'admin', 'staff'].includes(profile.role)) {
          await logAuthEvent('login_failed', { reason: 'No admin access', role: profile.role });
          setError('You do not have admin access. Please contact your administrator.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        await logAuthEvent('login_success', { role: profile.role });
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      await logAuthEvent('login_failed', { reason: 'Unexpected error' });
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center lg:text-left">
        <Link href="/" className={styles.brandLink}>
          {/* h-10 on a phone, h-14 from lg — the compact brand bar already
              sits above this below lg, so the mark does not need to shout. */}
          <BrandLogo variant="full" size="md" tone="auto" priority className="lg:h-14" />
        </Link>
        <p className={authForm.eyebrow}>Admin Enrollment</p>
        <h2 className={authForm.title}>Welcome back</h2>
        <p className={authForm.subtitle}>
          Sign in to MMS — members, billing, commissions, and ops.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && <AuthFormError>{error}</AuthFormError>}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className={authForm.label}>
              Email Address
            </label>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <EnvelopeSimple weight="light" aria-hidden="true" className={authForm.inputIcon} />
              <input
                id="email"
                type="email"
                placeholder="you@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={authForm.input}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={authForm.label}>
                Password
              </label>
              <Link href="/reset-password" className={authForm.link}>
                Forgot password?
              </Link>
            </div>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Lock weight="light" aria-hidden="true" className={authForm.inputIcon} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={`${authForm.input} pr-14`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                aria-controls="password"
                className={authForm.fieldAffix}
              >
                {showPassword ? (
                  <EyeSlash weight="light" aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <Eye weight="light" aria-hidden="true" className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* One control, not a 20px button beside an unbound <label>. Same
            toggle, same copy — it is now 44px, keyboard operable, and its
            state is announced. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={rememberMe}
          onClick={() => setRememberMe(!rememberMe)}
          className={styles.remember}
        >
          <span
            aria-hidden="true"
            className={`${styles.rememberBox} ${
              rememberMe ? authForm.checkboxOn : authForm.checkboxOff
            }`}
          >
            {rememberMe && <Square weight="fill" className="h-2.5 w-2.5" />}
          </span>
          <span className={authForm.checkboxLabel}>Remember me for 30 days</span>
        </button>

        <button
          type="submit"
          className={authForm.submitBtn}
          disabled={loading}
          aria-busy={loading}
        >
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center">
              <CircleNotch weight="light" aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              Enter Admin
              <span aria-hidden="true" className="ml-2">&rarr;</span>
            </span>
          )}
        </button>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className={authForm.dividerLine} />
          </div>
          <div className="relative flex justify-center">
            <span className={authForm.dividerText}>Need MMS access?</span>
          </div>
        </div>

        <button
          type="button"
          className={authForm.secondaryBtn}
          onClick={() => {
            window.location.href = 'mailto:support@payitforwardhealth.com';
          }}
        >
          Contact Administrator
        </button>
      </form>

      <div className={styles.assure}>
        <div className={styles.chips}>
          <span className={`${styles.chip} ${styles.chipLead}`}>
            <ShieldCheck weight="light" aria-hidden="true" className={styles.chipIcon} />
            HIPAA-aware
          </span>
          <span className={`${styles.chip} ${styles.chipCounter}`}>
            <Lock weight="light" aria-hidden="true" className={styles.chipIcon} />
            256-bit TLS
          </span>
        </div>

        <p className={styles.marks}>
          <span className={styles.mark}>
            <Pulse weight="light" aria-hidden="true" className={styles.markIcon} />
            MFA ready
          </span>
          <span aria-hidden="true" className={styles.markDot} />
          <span className={styles.mark}>
            <FirstAidKit weight="light" aria-hidden="true" className={styles.markIcon} />
            PHI secure
          </span>
          <span aria-hidden="true" className={styles.markDot} />
          <span className={styles.mark}>
            <ShieldCheck weight="light" aria-hidden="true" className={styles.markIcon} />
            Audit logged
          </span>
        </p>

        <p className={authForm.footer}>
          © 2026 Double Helix Hub. All rights reserved.
          {' · '}
          <Link href="/legal/sms-privacy" className={authForm.link}>
            SMS Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
