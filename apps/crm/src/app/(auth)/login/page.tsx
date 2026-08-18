'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { AuthFormError, AuthFormHeader, authForm } from '@crm-eco/ui';
import Link from 'next/link';
import {
  CircleNotch,
  Lock,
  Eye,
  EyeSlash,
  EnvelopeSimple,
  ShieldCheck,
  Square,
} from '@phosphor-icons/react';
import styles from '@/styles/crm-auth.module.css';

export const dynamic = 'force-dynamic';

/**
 * VISUAL REDESIGN ONLY.
 *
 * Unchanged, deliberately: the Supabase `signInWithPassword` call, the
 * `profiles` lookup and its `signOut` on failure, the `router.push('/crm')`
 * + `router.refresh()` destination, every error string, the field ids
 * (`email`, `password`), `required`, both `autoComplete` values, and the
 * `export const dynamic` directive.
 *
 * NOTE for the reviewer: this route is NOT the one middleware sends
 * unauthenticated users to (that is /crm-login) and it has neither tenant
 * branding nor the MFA challenge. `header.tsx` still pushes here on sign-out,
 * so it is reachable. See the hand-off report.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        if (profileError || !profile) {
          setError('No profile found. Please contact your administrator.');
          await supabase.auth.signOut();
          return;
        }

        router.push('/crm');
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Was a hand-rolled logo + `text-[10px] … text-cyan-700` eyebrow. The
          shared header is the same block, and its eyebrow uses the mono face
          and the tone token instead of a remapped Tailwind cyan. */}
      <AuthFormHeader
        eyebrow="CRM Core"
        title="Welcome back"
        subtitle="Sign in to your pipeline, modules, and workqueue."
      />

      <form onSubmit={handleLogin} className="space-y-6">
        {/* Was a bare <div>: a screen reader never announced a failed sign-in. */}
        {error && <AuthFormError>{error}</AuthFormError>}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className={authForm.label}>
              Email Address
            </label>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <EnvelopeSimple weight="light" className={authForm.inputIcon} />
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
              <Lock weight="light" className={authForm.inputIcon} />
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
              {/* Was an unlabelled ~20px icon at `absolute right-4`. Same
                  handler, now a 44px target with an accessible name. */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={authForm.fieldAffix}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
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

        {/* The box is still 20px; `.checkboxHit::before` extends the pointer
            target to 44px. `htmlFor` gives the control a real accessible name
            and lets the browser forward the label click natively — which is
            why the label's own onClick had to go, or it would toggle twice. */}
        <div className={styles.checkboxRow}>
          <button
            type="button"
            id="remember-me"
            role="checkbox"
            aria-checked={rememberMe}
            aria-labelledby="remember-me-label"
            onClick={() => setRememberMe(!rememberMe)}
            className={`${styles.checkboxHit} ${
              rememberMe ? authForm.checkboxOn : authForm.checkboxOff
            }`}
          >
            {rememberMe && <Square weight="fill" className={styles.checkboxMark} />}
          </button>
          <label id="remember-me-label" htmlFor="remember-me" className={authForm.checkboxLabel}>
            Remember me for 30 days
          </label>
        </div>

        <button type="submit" className={authForm.submitBtn} disabled={loading}>
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center">
              <CircleNotch weight="light" className="mr-2 h-5 w-5 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              Enter CRM
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                &rarr;
              </span>
            </span>
          )}
        </button>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className={authForm.dividerLine} />
          </div>
          <div className="relative flex justify-center">
            <span className={authForm.dividerText}>Need CRM access?</span>
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

      <div className="mt-8 space-y-4 text-center">
        {/* Was `text-cyan-400/90` — a remapped Tailwind cyan at 90% opacity,
            which fell under AA on the light panel. Now the shared mono
            assurance line: --auth-muted-soft, 5.1:1 in both themes. */}
        <p className={styles.assuranceRow}>
          <span className={styles.assuranceItem}>
            <ShieldCheck weight="light" className={styles.assuranceIcon} aria-hidden="true" />
            Org-isolated · Encrypted in transit
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
