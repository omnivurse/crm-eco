'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { BrandLogo, authForm } from '@crm-eco/ui';
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
        <Link href="/" className="mb-6 inline-flex items-center">
          <BrandLogo variant="full" size="lg" tone="white" priority />
        </Link>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/90">
          Admin Enrollment
        </p>
        <h2 className={authForm.title}>Welcome back</h2>
        <p className={authForm.subtitle}>
          Sign in to MMS — members, billing, commissions, and ops.
        </p>
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
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-white/35 transition-colors hover:text-white/70"
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
          <label onClick={() => setRememberMe(!rememberMe)} className={authForm.checkboxLabel}>
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
              Enter Admin
              <span className="ml-2 transition-transform group-hover:translate-x-1">&rarr;</span>
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
            window.location.href = 'mailto:support@doublehelixhub.com';
          }}
        >
          Contact Administrator
        </button>
      </form>

      <div className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
            <ShieldCheck weight="light" className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-300">HIPAA-aware</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5">
            <Lock weight="light" className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-300">256-bit TLS</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1">
            <Pulse weight="light" className="h-3.5 w-3.5 text-emerald-400/80" />
            MFA ready
          </span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span className="inline-flex items-center gap-1">
            <FirstAidKit weight="light" className="h-3.5 w-3.5 text-emerald-400/80" />
            PHI secure
          </span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span className="inline-flex items-center gap-1">
            <ShieldCheck weight="light" className="h-3.5 w-3.5 text-emerald-400/80" />
            Audit logged
          </span>
        </div>

        <p className={authForm.footer}>© 2026 Double Helix Hub. All rights reserved.</p>
      </div>
    </div>
  );
}
