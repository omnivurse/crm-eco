'use client';

// Force dynamic rendering to avoid static prerender issues with this client component
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
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

// Premium Orbit Animation with vivid colors and enhanced effects
function PremiumOrbitAnimation() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Predefined node configurations for consistent rendering
  const orbitNodes = [
    // Inner orbit nodes
    { ring: 1, position: 'top', icon: Users, color: 'teal', size: 'sm' },
    { ring: 1, position: 'bottom', icon: BarChart3, color: 'violet', size: 'sm' },
    // Middle orbit nodes
    { ring: 2, position: 'topLeft', icon: Briefcase, color: 'blue', size: 'md' },
    { ring: 2, position: 'bottomRight', icon: Database, color: 'emerald', size: 'md' },
    { ring: 2, position: 'left', icon: Zap, color: 'amber', size: 'sm' },
    // Outer orbit nodes
    { ring: 3, position: 'top', icon: Target, color: 'cyan', size: 'md' },
    { ring: 3, position: 'bottom', icon: HeartHandshake, color: 'rose', size: 'md' },
    { ring: 3, position: 'right', icon: Globe, color: 'indigo', size: 'sm' },
    { ring: 3, position: 'left', icon: TrendingUp, color: 'green', size: 'sm' },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    teal: { bg: 'bg-teal-500', border: 'border-teal-400', text: 'text-teal-400', glow: 'rgba(20,184,166,0.6)' },
    violet: { bg: 'bg-violet-500', border: 'border-violet-400', text: 'text-violet-400', glow: 'rgba(139,92,246,0.6)' },
    blue: { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-400', glow: 'rgba(59,130,246,0.6)' },
    emerald: { bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-400', glow: 'rgba(16,185,129,0.6)' },
    amber: { bg: 'bg-amber-500', border: 'border-amber-400', text: 'text-amber-400', glow: 'rgba(245,158,11,0.6)' },
    cyan: { bg: 'bg-cyan-500', border: 'border-cyan-400', text: 'text-cyan-400', glow: 'rgba(6,182,212,0.6)' },
    rose: { bg: 'bg-rose-500', border: 'border-rose-400', text: 'text-rose-400', glow: 'rgba(244,63,94,0.6)' },
    indigo: { bg: 'bg-indigo-500', border: 'border-indigo-400', text: 'text-indigo-400', glow: 'rgba(99,102,241,0.6)' },
    green: { bg: 'bg-green-500', border: 'border-green-400', text: 'text-green-400', glow: 'rgba(34,197,94,0.6)' },
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Deep ambient glow layers - more vibrant */}
      <div className="absolute w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[150px]" />
      <div className="absolute w-[400px] h-[400px] bg-emerald-500/25 rounded-full blur-[100px] animate-[pulse_4s_ease-in-out_infinite]" />
      <div className="absolute w-[250px] h-[250px] bg-cyan-400/30 rounded-full blur-[80px] animate-[pulse_3s_ease-in-out_infinite_0.5s]" />

      {/* Core nucleus with bright pulsing effect */}
      <div className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-teal-500/40 to-emerald-600/30 backdrop-blur-xl border-2 border-teal-400/60 flex items-center justify-center z-20 shadow-[0_0_80px_30px_rgba(20,184,166,0.4)]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-400/30 to-transparent animate-[spin_8s_linear_infinite]" />
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-[0_0_40px_15px_rgba(20,184,166,0.5)]">
          <Heart className="w-7 h-7 text-white drop-shadow-lg" />
        </div>
      </div>

      {/* Pulsing core ring */}
      <div className="absolute w-36 h-36 rounded-full border-2 border-teal-400/40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />

      {/* Orbit Ring 1 - Fast inner */}
      <div className="absolute w-[220px] h-[220px]">
        <div className="absolute inset-0 rounded-full border border-teal-400/30" />
        <div className="absolute inset-0 rounded-full animate-[spin_15s_linear_infinite]">
          {/* Top node */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <div className="relative group">
              <div className="absolute -inset-2 bg-teal-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-teal-400/70 shadow-[0_0_25px_8px_rgba(20,184,166,0.4)]">
                <Users className="w-5 h-5 text-teal-400" />
              </div>
            </div>
          </div>
          {/* Bottom node */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <div className="relative group">
              <div className="absolute -inset-2 bg-violet-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-violet-400/70 shadow-[0_0_25px_8px_rgba(139,92,246,0.4)]">
                <BarChart3 className="w-5 h-5 text-violet-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orbit Ring 2 - Medium */}
      <div className="absolute w-[360px] h-[360px]">
        <div className="absolute inset-0 rounded-full border border-white/10" />
        <div className="absolute inset-0 rounded-full border border-dashed border-teal-500/20 animate-[spin_25s_linear_infinite_reverse]">
          {/* Top left node */}
          <div className="absolute top-6 -left-3">
            <div className="relative">
              <div className="absolute -inset-2 bg-blue-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3.5 rounded-xl border-2 border-blue-400/70 shadow-[0_0_25px_8px_rgba(59,130,246,0.4)]">
                <Briefcase className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>
          {/* Bottom right node */}
          <div className="absolute bottom-6 -right-3">
            <div className="relative">
              <div className="absolute -inset-2 bg-emerald-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3.5 rounded-xl border-2 border-emerald-400/70 shadow-[0_0_25px_8px_rgba(16,185,129,0.4)]">
                <Database className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>
          {/* Left node */}
          <div className="absolute top-1/2 -left-4 -translate-y-1/2">
            <div className="relative">
              <div className="absolute -inset-2 bg-amber-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-amber-400/70 shadow-[0_0_25px_8px_rgba(245,158,11,0.4)]">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orbit Ring 3 - Outer slow */}
      <div className="absolute w-[500px] h-[500px]">
        <div className="absolute inset-0 rounded-full border border-white/5" />
        <div className="absolute inset-0 rounded-full animate-[spin_40s_linear_infinite]">
          {/* Top node */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute -inset-2 bg-cyan-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3.5 rounded-xl border-2 border-cyan-400/70 shadow-[0_0_25px_8px_rgba(6,182,212,0.4)]">
                <Target className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
          </div>
          {/* Bottom node */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="relative">
              <div className="absolute -inset-2 bg-rose-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3.5 rounded-xl border-2 border-rose-400/70 shadow-[0_0_25px_8px_rgba(244,63,94,0.4)]">
                <HeartHandshake className="w-5 h-5 text-rose-400" />
              </div>
            </div>
          </div>
          {/* Right node */}
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute -inset-2 bg-indigo-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-indigo-400/70 shadow-[0_0_25px_8px_rgba(99,102,241,0.4)]">
                <Globe className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
          </div>
          {/* Left node */}
          <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute -inset-2 bg-green-400 rounded-full blur-lg opacity-70 animate-pulse" />
              <div className="relative bg-slate-900 p-3 rounded-xl border-2 border-green-400/70 shadow-[0_0_25px_8px_rgba(34,197,94,0.4)]">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating particles - brighter */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => {
          const size = 3 + (i % 4);
          const delay = (i * 0.5) % 20;
          const duration = 15 + (i % 10);
          const colorChoice = i % 3 === 0 ? 'teal' : i % 3 === 1 ? 'emerald' : 'cyan';
          const colors = { teal: '20,184,166', emerald: '16,185,129', cyan: '6,182,212' };
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                background: `rgba(${colors[colorChoice]}, 0.8)`,
                top: `${10 + (i * 7) % 80}%`,
                left: `${5 + (i * 11) % 90}%`,
                animation: `float-particle ${duration}s ease-in-out infinite`,
                animationDelay: `-${delay}s`,
                boxShadow: `0 0 ${size * 3}px rgba(${colors[colorChoice]}, 0.7)`,
              }}
            />
          );
        })}
      </div>

      {/* Connection lines between nodes - subtle */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(20,184,166)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(20,184,166)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(20,184,166)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
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
        await supabase.auth.signOut();
        setError('You do not have access to the CRM. Please contact your administrator.');
        setLoading(false);
        return;
      }

      router.push('/crm');
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Premium Visuals with deep dark background */}
      <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-slate-950">
        {/* Deep dark animated gradient background */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900"
          style={{
            backgroundSize: '400% 400%',
            animation: 'gradient-flow 15s ease infinite',
          }}
        />

        {/* Vibrant mesh gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.12),transparent_50%),radial-gradient(ellipse_at_center,rgba(6,182,212,0.08),transparent_60%)]" />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:60px_60px]" />

        <PremiumOrbitAnimation />

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
                  Sign in to CRM
                  <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </>
              )}
            </Button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-navy-200"></div>
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
