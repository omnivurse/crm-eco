'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Heart,
  Users,
  Shield,
  Activity,
  Stethoscope,
  HeartHandshake,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Square,
  BarChart3,
  Database,
  Briefcase,
  Target,
  Zap,
  Globe,
  TrendingUp
} from 'lucide-react';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

// Static CRM Visual (no animations)
function StaticCrmVisual() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Static ambient glow layers */}
      <div className="absolute w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[150px]" />
      <div className="absolute w-[400px] h-[400px] bg-emerald-500/25 rounded-full blur-[100px]" />
      <div className="absolute w-[250px] h-[250px] bg-cyan-400/30 rounded-full blur-[80px]" />

      {/* Core nucleus */}
      <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-teal-500/40 to-emerald-600/30 backdrop-blur-xl border-2 border-teal-400/60 flex items-center justify-center z-20 shadow-[0_0_80px_30px_rgba(20,184,166,0.4)]">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-[0_0_40px_15px_rgba(20,184,166,0.5)]">
          <Heart className="w-7 h-7 text-white drop-shadow-lg" />
        </div>
      </div>

      {/* Inner orbit ring with static icons */}
      <div className="absolute w-[220px] h-[220px]">
        <div className="absolute inset-0 rounded-full border border-teal-400/30" />
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-teal-400/70 shadow-[0_0_25px_8px_rgba(20,184,166,0.4)]">
            <Users className="w-5 h-5 text-teal-400" />
          </div>
        </div>
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
          <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-violet-400/70 shadow-[0_0_25px_8px_rgba(139,92,246,0.4)]">
            <BarChart3 className="w-5 h-5 text-violet-400" />
          </div>
        </div>
      </div>

      {/* Middle orbit ring */}
      <div className="absolute w-[360px] h-[360px]">
        <div className="absolute inset-0 rounded-full border border-dashed border-teal-500/20" />
        <div className="absolute top-6 -left-3">
          <div className="relative bg-slate-900 p-3.5 rounded-xl border-2 border-blue-400/70 shadow-[0_0_25px_8px_rgba(59,130,246,0.4)]">
            <Briefcase className="w-5 h-5 text-blue-400" />
          </div>
        </div>
        <div className="absolute bottom-6 -right-3">
          <div className="relative bg-slate-900 p-3.5 rounded-xl border-2 border-emerald-400/70 shadow-[0_0_25px_8px_rgba(16,185,129,0.4)]">
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
        <div className="absolute top-1/2 -left-4 -translate-y-1/2">
          <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-amber-400/70 shadow-[0_0_25px_8px_rgba(245,158,11,0.4)]">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Outer orbit ring */}
      <div className="absolute w-[500px] h-[500px]">
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative bg-slate-900 p-3.5 rounded-xl border-2 border-cyan-400/70 shadow-[0_0_25px_8px_rgba(6,182,212,0.4)]">
            <Target className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className="relative bg-slate-900 p-3.5 rounded-xl border-2 border-rose-400/70 shadow-[0_0_25px_8px_rgba(244,63,94,0.4)]">
            <HeartHandshake className="w-5 h-5 text-rose-400" />
          </div>
        </div>
        <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
          <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-indigo-400/70 shadow-[0_0_25px_8px_rgba(99,102,241,0.4)]">
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
        </div>
        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2">
          <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-green-400/70 shadow-[0_0_25px_8px_rgba(34,197,94,0.4)]">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CrmLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Log failed login attempt
        await logAuthEvent('login_failed', { reason: authError.message });
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        await logAuthEvent('login_failed', { reason: 'No user returned' });
        setError('Authentication failed');
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, crm_role, organization_id')
        .eq('user_id', authData.user.id)
        .not('crm_role', 'is', null)
        .single();

      if (profileError || !profile) {
        await logAuthEvent('login_failed', { reason: 'No CRM access', profileError: profileError?.message });
        await supabase.auth.signOut();
        setError('You do not have access to the CRM. Please contact your administrator.');
        setLoading(false);
        return;
      }

      // Log successful login
      await logAuthEvent('login_success', { role: profile.crm_role });

      router.push('/crm');
      router.refresh();
    } catch (err) {
      await logAuthEvent('login_failed', { reason: 'Unexpected error' });
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Premium Visuals with deep dark background */}
      <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-slate-950">
        {/* Static gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" />

        {/* Vibrant mesh gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.12),transparent_50%),radial-gradient(ellipse_at_center,rgba(6,182,212,0.08),transparent_60%)]" />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:60px_60px]" />

        <StaticCrmVisual />

        {/* Bottom branding */}
        <div className="absolute bottom-12 left-12 z-10">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(20,184,166,0.5)]">Pay It Forward</span>
            <br />
            <span className="text-white/95">HealthShare</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            CRM Portal — Manage your healthcare community
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="flex justify-center lg:justify-start mb-6">
              <Image
                src="/logo.png"
                alt="Pay It Forward HealthShare"
                width={200}
                height={80}
                className="h-16 w-auto object-contain"
                priority
              />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-brand-navy-800">
              Welcome back
            </h2>
            <p className="mt-2 text-brand-navy-500">
              Sign in to access your CRM dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                    placeholder="you@company.com"
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
                  <Link
                    href="/reset-password"
                    className="text-sm text-brand-teal-600 hover:text-brand-teal-700 transition-colors"
                  >
                    Forgot password?
                  </Link>
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
                  Sign in to CRM
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
                  Need CRM Access?
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-14 border-brand-navy-200 bg-white text-brand-navy-700 hover:bg-brand-navy-50 hover:text-brand-navy-900 hover:border-brand-navy-300 rounded-xl transition-all shadow-sm"
              onClick={() => window.location.href = 'mailto:support@payitforwardhealthshare.com'}
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
            <div className="flex items-center justify-center gap-3 text-xs text-brand-navy-500">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-teal-500" />
                MFA Protected
              </span>
              <span className="w-1 h-1 rounded-full bg-brand-navy-300" />
              <span className="flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-teal-500" />
                PHI Secure
              </span>
              <span className="w-1 h-1 rounded-full bg-brand-navy-300" />
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-teal-500" />
                Audit Logging
              </span>
            </div>

            <p className="text-brand-navy-400 text-xs text-center">
              © 2026 Pay It Forward HealthShare. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
