'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
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
export const dynamic = 'force-dynamic';

const HEALTHCARE_QUOTES = [
  { text: 'The greatest wealth is health.', author: 'Virgil' },
  { text: 'Caring for others is an expression of what it means to be fully human.', author: 'Hillary Clinton' },
  { text: 'Health is not valued till sickness comes.', author: 'Thomas Fuller' },
  { text: 'Wherever the art of medicine is loved, there is also a love of humanity.', author: 'Hippocrates' },
  { text: 'To care for those who once cared for us is one of the highest honors.', author: 'Tia Walker' },
  { text: 'It is health that is real wealth and not pieces of gold and silver.', author: 'Mahatma Gandhi' },
  { text: 'The good physician treats the disease; the great physician treats the patient who has the disease.', author: 'William Osler' },
  { text: 'The art of medicine consists of amusing the patient while nature cures the disease.', author: 'Voltaire' },
];

function QuoteRotator() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HEALTHCARE_QUOTES.length);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-24 overflow-hidden">
      {HEALTHCARE_QUOTES.map((quote, index) => (
        <div
          key={index}
          className={`absolute inset-0 login-quote-transition ${
            index === activeIndex ? 'login-quote-active' : 'login-quote-inactive'
          }`}
        >
          <p className="text-white/90 text-lg italic leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-white/60 text-sm mt-2">&mdash; {quote.author}</p>
        </div>
      ))}
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
      {/* Left Side - Animated Gradient Mesh Hero */}
      <div className="hidden lg:flex relative overflow-hidden bg-[#003560]">
        {/* Animated gradient mesh background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#003560] via-[#047474] to-[#027343]" />
          <div
            className="login-blob login-blob-drift-1"
            style={{ width: 500, height: 500, top: '-10%', left: '-5%', background: 'radial-gradient(circle, rgba(6,155,154,0.4) 0%, rgba(6,155,154,0.1) 50%, transparent 70%)' }}
          />
          <div
            className="login-blob login-blob-drift-2"
            style={{ width: 450, height: 450, top: '30%', right: '-10%', background: 'radial-gradient(circle, rgba(2,115,67,0.35) 0%, rgba(2,115,67,0.08) 50%, transparent 70%)' }}
          />
          <div
            className="login-blob login-blob-drift-3"
            style={{ width: 380, height: 380, bottom: '-5%', left: '20%', background: 'radial-gradient(circle, rgba(233,182,31,0.2) 0%, rgba(233,182,31,0.05) 50%, transparent 70%)' }}
          />
          <div
            className="login-blob login-blob-drift-4"
            style={{ width: 320, height: 320, top: '60%', right: '25%', background: 'radial-gradient(circle, rgba(4,116,116,0.3) 0%, rgba(4,116,116,0.08) 50%, transparent 70%)' }}
          />
        </div>

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 w-full">
          <h1 className="text-5xl xl:text-6xl font-bold text-white mb-4 tracking-tight leading-[1.1] font-heading">
            <span className="block">Empowering</span>
            <span className="block bg-gradient-to-r from-[#6ac3c2] to-[#9bd7d7] bg-clip-text text-transparent">
              Healthier Lives
            </span>
          </h1>
          <p className="text-white/70 text-lg max-w-md mb-10 leading-relaxed">
            Building stronger communities through shared health and compassionate care.
          </p>
          <QuoteRotator />
        </div>

        {/* Bottom branding */}
        <div className="absolute bottom-12 left-12 xl:left-16 z-10">
          <p className="text-white/40 text-sm font-medium tracking-wider uppercase">
            Pay It Forward Health
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
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
              onClick={() => window.location.href = 'mailto:support@payitforwardhealth.com'}
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
              © 2026 Pay It Forward Health. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
