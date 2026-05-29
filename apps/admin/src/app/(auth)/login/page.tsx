'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button, Input, Label, BrandLogo } from '@crm-eco/ui';
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
import LoginHero from '@/components/auth/LoginHero';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Log authentication events
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
        // Log failed login attempt
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

        // Check if user has admin access
        if (!['owner', 'super_admin', 'admin', 'staff'].includes(profile.role)) {
          await logAuthEvent('login_failed', { reason: 'No admin access', role: profile.role });
          setError('You do not have admin access. Please contact your administrator.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Log successful login
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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Hero Image */}
      <div className="hidden lg:flex relative overflow-hidden bg-[#0f172a]">
        <LoginHero />
      </div>

        {/* Right Side - Login Form */}
        <div className="flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start mb-6">
                <BrandLogo variant="full" size="lg" tone="color" priority />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-800">
                Welcome back
              </h2>
              <p className="mt-2 text-slate-500">
                Sign in to access your admin dashboard
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-purple-600 transition-colors z-10" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="relative pl-12 h-14 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 text-sm font-medium">
                      Password
                    </Label>
                    <Link
                      href="/reset-password"
                      className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-purple-600 transition-colors z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="•••••••••••••"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="relative pl-12 pr-12 h-14 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
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
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${rememberMe
                      ? 'bg-purple-500 border-purple-500 shadow-[0_0_10px_2px_rgba(147,51,234,0.3)]'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                    }`}
                >
                  {rememberMe && <Square className="w-2.5 h-2.5 text-white fill-current" />}
                </button>
                <label
                  onClick={() => setRememberMe(!rememberMe)}
                  className="text-sm text-slate-600 cursor-pointer select-none"
                >
                  Remember me for 30 days
                </label>
              </div>

              <Button
                type="submit"
                className="relative w-full h-14 text-base font-semibold bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 text-white border-0 rounded-xl transition-all overflow-hidden group"
                disabled={loading}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to Admin
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </>
                )}
              </Button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 text-slate-400 text-xs uppercase tracking-widest">
                    Need Admin Access?
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-14 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 rounded-xl transition-all shadow-sm"
                onClick={() => window.location.href = 'mailto:support@doublehelixhub.com'}
              >
                Contact Administrator
              </Button>
            </form>

            <div className="mt-8 space-y-4">
              {/* Security Certifications */}
              <div className="flex items-center justify-center gap-4">
                {/* HIPAA Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700">HIPAA Compliant</span>
                </div>
                {/* Encryption Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-700">256-bit Encryption</span>
                </div>
              </div>

              {/* MFA & Session Security */}
              <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-purple-500" />
                  MFA Protected
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-purple-500" />
                  PHI Secure
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-purple-500" />
                  Audit Logging
                </span>
              </div>

              <p className="text-slate-400 text-xs text-center">
                © 2026 Double Helix Hub. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}
