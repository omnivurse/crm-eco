'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Heart,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Shield,
  CheckCircle2,
  AlertCircle,
  Users,
  FileCheck,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 60_000;

const trustPoints = [
  {
    icon: Shield,
    title: 'HIPAA Compliant',
    description: 'Your health information is protected to the highest standards.',
  },
  {
    icon: Lock,
    title: '256-bit Encryption',
    description: 'All data in transit and at rest is encrypted end-to-end.',
  },
  {
    icon: Users,
    title: 'Member-First Community',
    description: 'Join thousands of families sharing medical expenses together.',
  },
  {
    icon: FileCheck,
    title: 'Transparent Sharing',
    description: 'Clear guidelines and real-time visibility into your needs.',
  },
];

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [mounted, setMounted] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutSeconds(0);
        setFailedAttempts(0);
        setError(null);
      } else {
        setLockoutSeconds(remaining);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const getErrorMessage = (msg: string): string => {
    if (msg.includes('Invalid login credentials')) {
      const remaining = LOCKOUT_THRESHOLD - (failedAttempts + 1);
      if (remaining > 0) {
        return `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout.`;
      }
      return 'Invalid email or password.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Please check your email and confirm your account before signing in.';
    }
    if (msg.includes('Too many requests')) {
      return 'Too many sign-in attempts. Please wait a moment and try again.';
    }
    return msg;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= LOCKOUT_THRESHOLD) {
          setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
          setError('Too many failed attempts. Please wait 60 seconds before trying again.');
        } else {
          setError(getErrorMessage(signInError.message));
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        setFailedAttempts(0);

        // Check profile for role-based routing
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('user_id', data.user.id)
          .single() as { data: { id: string; role: string } | null };

        // Check if user is an agent
        let advisor = null;
        if (profile && profile.role === 'advisor') {
          const { data: advisorData } = await supabase
            .from('advisors')
            .select('id, status')
            .eq('profile_id', profile.id)
            .single() as { data: { id: string; status: string } | null };
          advisor = advisorData;
        }

        if (advisor) {
          if (advisor.status !== 'active') {
            setError('Your agent account is not active. Please contact support.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
          router.push('/agent');
        } else {
          router.push(redirectTo);
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Left Panel - Branding & Trust */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] relative overflow-hidden flex-col justify-between">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#003560] via-[#04545c] to-[#047474]" />

        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Glowing orbs for depth */}
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-[#047474]/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#069B9A]/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-12">
          {/* Logo */}
          <div>
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-lg leading-tight block">Pay It Forward</span>
                <span className="text-[#69d1d1] text-xs font-semibold tracking-wider uppercase">HealthShare</span>
              </div>
            </Link>
          </div>

          {/* Hero text */}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
                Your health sharing<br />community awaits.
              </h1>
              <p className="text-white/60 mt-4 text-base leading-relaxed max-w-sm">
                Access your dashboard, manage your needs, and stay connected with your healthshare family.
              </p>
            </div>

            {/* Trust points */}
            <div className="space-y-4">
              {trustPoints.map((point) => (
                <div key={point.title} className="flex items-start gap-3.5 group">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/15 transition-colors">
                    <point.icon className="w-4 h-4 text-[#69d1d1]" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{point.title}</p>
                    <p className="text-white/45 text-xs mt-0.5 leading-relaxed">{point.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/30 text-xs">
            &copy; {new Date().getFullYear()} Pay It Forward HealthShare. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6 sm:p-8">
        <div
          className={`w-full max-w-[420px] transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#047474] to-[#069B9A] flex items-center justify-center shadow-md">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-[#003560] leading-tight">Pay It Forward</span>
                <span className="text-xs text-[#047474] font-semibold">HealthShare</span>
              </div>
            </Link>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              Sign in to your account to continue.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
            <form onSubmit={handleSignIn} className="space-y-5">
              {/* Error message */}
              {error && (
                <div className="flex items-start gap-3 p-3.5 text-sm bg-red-50 border border-red-200/80 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-red-700 leading-relaxed">{error}</span>
                </div>
              )}

              {/* Lockout warning */}
              {isLockedOut && (
                <div className="flex items-center gap-3 p-3.5 text-sm bg-amber-50 border border-amber-200/80 rounded-xl">
                  <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="text-amber-800">
                    Account temporarily locked. Try again in{' '}
                    <span className="font-semibold tabular-nums">{lockoutSeconds}s</span>
                  </span>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-sm font-medium text-slate-700">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    disabled={isLockedOut}
                    className="h-11 pl-10 bg-slate-50/50 border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#047474] focus:ring-[#047474]/20 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password" className="text-sm font-medium text-slate-700">
                    Password
                  </Label>
                  <Link
                    href="/reset-password"
                    className="text-xs font-medium text-[#047474] hover:text-[#035f5f] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    disabled={isLockedOut}
                    className="h-11 pl-10 pr-11 bg-slate-50/50 border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#047474] focus:ring-[#047474]/20 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold rounded-xl bg-[#047474] hover:bg-[#035f5f] active:bg-[#025050] text-white border-0 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-[#047474]/15 disabled:opacity-50"
                disabled={loading || isLockedOut}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            {/* Agent link */}
            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-sm">
                Are you an agent?{' '}
                <Link href="/signup" className="text-[#047474] hover:text-[#035f5f] font-medium transition-colors">
                  Register here
                </Link>
              </p>
            </div>
          </div>

          {/* Security footer */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>SSL Secured</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-green-500" />
                <span>HIPAA Compliant</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-green-500" />
                <span>Encrypted</span>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400">
              By signing in you agree to our{' '}
              <Link href="/terms" className="text-[#047474] hover:underline">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-[#047474] hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
