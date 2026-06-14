'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { BrandLogo, authForm } from '@crm-eco/ui';
import {
  Shield,
  Activity,
  Stethoscope,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Square,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          await logAuthEvent('login_failed', { reason: 'No profile found', profileError: profileError?.message });
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
        <Link href="/" className="inline-flex items-center mb-6 group">
          <BrandLogo variant="full" size="lg" tone="white" priority />
        </Link>
        <h2 className={authForm.title}>Welcome back</h2>
        <p className={authForm.subtitle}>Sign in to MMS — Member Management System</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {error && <div className={authForm.error}>{error}</div>}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className={authForm.label}>Email Address</label>
            <div className="relative group">
              <div className={authForm.inputGlow} />
              <Mail className={authForm.inputIcon} />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
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
              <label htmlFor="password" className={authForm.label}>Password</label>
              <Link href="/reset-password" className={authForm.link}>Forgot password?</Link>
            </div>
            <div className="relative group">
              <div className={authForm.inputGlow} />
              <Lock className={authForm.inputIcon} />
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 z-10"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setRememberMe(!rememberMe)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              rememberMe ? authForm.checkboxOn : authForm.checkboxOff
            }`}
          >
            {rememberMe && <Square className="w-2.5 h-2.5 text-white fill-current" />}
          </button>
          <label onClick={() => setRememberMe(!rememberMe)} className={authForm.checkboxLabel}>
            Remember me for 30 days
          </label>
        </div>

        <button type="submit" className={authForm.submitBtn} disabled={loading}>
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              Sign in to MMS
              <span className="ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
            </span>
          )}
        </button>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className={authForm.dividerLine} />
          </div>
          <div className="relative flex justify-center">
            <span className={authForm.dividerText}>Need MMS Access?</span>
          </div>
        </div>

        <button
          type="button"
          className="w-full h-14 border border-slate-600 bg-slate-800/30 text-slate-200 hover:bg-slate-800/50 hover:border-slate-500 rounded-xl transition-all"
          onClick={() => { window.location.href = 'mailto:support@doublehelixhub.com'; }}
        >
          Contact Administrator
        </button>
      </form>

      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">HIPAA Compliant</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-300">256-bit Encryption</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            MFA Protected
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
            PHI Secure
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            Audit Logging
          </span>
        </div>

        <p className={authForm.footer}>© 2026 Double Helix Hub. All rights reserved.</p>
      </div>
    </div>
  );
}
