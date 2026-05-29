'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { BrandLogo } from '@crm-eco/ui/components/brand-logo';
import Link from 'next/link';
import {
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Shield,
  Square,
} from 'lucide-react';

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

        router.push('/dashboard');
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
      {/* Brand */}
      <div className="text-center lg:text-left">
        <Link href="/" className="inline-flex items-center mb-6 group">
          <BrandLogo variant="full" size="lg" tone="white" priority />
        </Link>
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
          Welcome Back
        </h2>
        <p className="mt-2 text-slate-400">
          Sign in to continue your journey
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-slate-300 text-sm font-medium block">
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors z-10" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="relative w-full pl-12 h-14 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 rounded-xl transition-all outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-slate-300 text-sm font-medium">
                Password
              </label>
              <Link
                href="/reset-password"
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors z-10" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="relative w-full pl-12 pr-12 h-14 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 rounded-xl transition-all outline-none"
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

        {/* Remember Me */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setRememberMe(!rememberMe)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              rememberMe
                ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_10px_2px_rgba(6,182,212,0.3)]'
                : 'border-slate-600 bg-transparent hover:border-slate-500'
            }`}
          >
            {rememberMe && <Square className="w-2.5 h-2.5 text-white fill-current" />}
          </button>
          <label
            onClick={() => setRememberMe(!rememberMe)}
            className="text-sm text-slate-400 cursor-pointer select-none"
          >
            Remember me for 30 days
          </label>
        </div>

        {/* Sign In Button */}
        <button
          type="submit"
          className="relative w-full h-14 text-base font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border-0 rounded-xl transition-all overflow-hidden group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_8px_30px_rgba(6,182,212,0.35)]"
          disabled={loading}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
          {loading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              Sign in
              <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">&rarr;</span>
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#0a1628] px-4 text-slate-500 text-xs uppercase tracking-widest">
              New Member?
            </span>
          </div>
        </div>

        {/* Enrollment CTA */}
        <button
          type="button"
          className="w-full h-14 border border-slate-700 bg-slate-800/30 text-slate-300 hover:bg-slate-800/50 hover:text-white hover:border-slate-600 rounded-xl transition-all cursor-pointer font-semibold"
          onClick={() => router.push('/crm/enrollment')}
        >
          Start your enrollment
        </button>
      </form>

      {/* Footer */}
      <div className="mt-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-cyan-400 text-xs font-medium">
          <Shield className="w-3.5 h-3.5" />
          <span>Secured with enterprise-grade encryption</span>
        </div>
        <p className="text-slate-600 text-xs">
          &copy; 2026 Double Helix Hub. All rights reserved.
        </p>
      </div>
    </div>
  );
}
