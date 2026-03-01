'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Button, Input, Label } from '@crm-eco/ui';
import {
  Shield,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Square,
} from 'lucide-react';
import Image from 'next/image';

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
      <div className="text-center lg:text-left">
        <div className="flex justify-center lg:justify-start mb-6">
          <Image
            src="/logo.png"
            alt="Pay It Forward Health"
            width={200}
            height={80}
            className="h-16 w-auto object-contain"
            priority
          />
        </div>
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-brand-navy-800 to-brand-teal-700 bg-clip-text text-transparent">
          Welcome Back
        </h2>
        <p className="mt-2 text-brand-navy-500">
          Sign in to continue your journey
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
            <Label htmlFor="email" className="text-brand-navy-700 text-sm font-medium">
              Email Address
            </Label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-teal-500/20 to-brand-emerald-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-navy-400 group-focus-within:text-brand-teal-600 transition-colors z-10" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="relative pl-12 h-14 bg-white border-brand-navy-200 text-brand-navy-900 placeholder:text-brand-navy-400 focus:border-brand-teal-500 focus:ring-brand-teal-500/20 rounded-xl transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-brand-navy-700 text-sm font-medium">
                Password
              </Label>
              <button
                type="button"
                className="text-sm text-brand-teal-600 hover:text-brand-teal-700 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-teal-500/20 to-brand-emerald-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-navy-400 group-focus-within:text-brand-teal-600 transition-colors z-10" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="•••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="relative pl-12 pr-12 h-14 bg-white border-brand-navy-200 text-brand-navy-900 placeholder:text-brand-navy-400 focus:border-brand-teal-500 focus:ring-brand-teal-500/20 rounded-xl transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-navy-400 hover:text-brand-navy-600 z-10"
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
                ? 'bg-brand-teal-500 border-brand-teal-500 shadow-[0_0_10px_2px_rgba(6,155,154,0.3)]'
                : 'border-brand-navy-300 bg-white hover:border-brand-navy-400'
              }`}
          >
            {rememberMe && <Square className="w-2.5 h-2.5 text-white fill-current" />}
          </button>
          <label
            onClick={() => setRememberMe(!rememberMe)}
            className="text-sm text-brand-navy-600 cursor-pointer select-none"
          >
            Remember me for 30 days
          </label>
        </div>

        <Button
          type="submit"
          className="relative w-full h-14 text-base font-semibold bg-gradient-to-r from-brand-teal-500 to-brand-emerald-500 hover:from-brand-teal-400 hover:to-brand-emerald-400 text-white border-0 rounded-xl transition-all overflow-hidden group"
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
              Sign in
              <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </>
          )}
        </Button>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-navy-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-brand-navy-400 text-xs uppercase tracking-widest">
              New Member?
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full h-14 border-brand-navy-200 bg-white text-brand-navy-700 hover:bg-brand-navy-50 hover:text-brand-navy-900 hover:border-brand-navy-300 rounded-xl transition-all shadow-sm"
          onClick={() => router.push('/crm/enrollment')}
        >
          Start your enrollment
        </Button>
      </form>

      <div className="mt-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-brand-teal-600 text-xs font-medium">
          <Shield className="w-3.5 h-3.5" />
          <span>Secured with enterprise-grade encryption</span>
        </div>
        <p className="text-brand-navy-400 text-xs">
          © 2026 Pay It Forward Health. All rights reserved.
        </p>
      </div>
    </div>
  );
}
