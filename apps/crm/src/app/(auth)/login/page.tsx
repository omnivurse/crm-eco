'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { BrandLogo, authForm } from '@crm-eco/ui';
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

export const dynamic = 'force-dynamic';

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
      <div className="text-center lg:text-left">
        <Link href="/" className="mb-6 inline-flex items-center">
          <BrandLogo variant="full" size="lg" tone="auto" priority />
        </Link>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-400/90">
          CRM Core
        </p>
        <h2 className={authForm.title}>Welcome back</h2>
        <p className={authForm.subtitle}>Sign in to your pipeline, modules, and workqueue.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && <div className={authForm.error}>{error}</div>}

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
                className={`${authForm.input} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-[var(--auth-muted)] transition-colors hover:text-[var(--auth-text)]"
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

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setRememberMe(!rememberMe)}
            className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
              rememberMe ? authForm.checkboxOn : authForm.checkboxOff
            }`}
          >
            {rememberMe && <Square weight="fill" className="h-2.5 w-2.5 text-white" />}
          </button>
          <label
            onClick={() => setRememberMe(!rememberMe)}
            className={authForm.checkboxLabel}
          >
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
        <div className="inline-flex items-center gap-2 text-xs font-medium text-cyan-400/90">
          <ShieldCheck weight="light" className="h-3.5 w-3.5" />
          <span>Org-isolated · Encrypted in transit</span>
        </div>
        <p className={authForm.footer}>© 2026 Double Helix Hub. All rights reserved.</p>
      </div>
    </div>
  );
}
