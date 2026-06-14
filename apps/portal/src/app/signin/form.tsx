'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
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
import { AuthSplitLayout, AuthHeroPanel, BrandLogo, authForm } from '@crm-eco/ui';

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
          window.location.assign('/agent');
        } else {
          // Full navigation so middleware receives auth cookies (client router.push alone races SSR)
          const destination = redirectTo.startsWith('/') ? redirectTo : '/';
          window.location.assign(destination);
        }
        return;
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      hero={
        <AuthHeroPanel
          headline={
            <>
              <span className="block">Your health sharing</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                community awaits
              </span>
            </>
          }
          subtitle="Access your dashboard, manage your needs, and stay connected with your health sharing family."
          badge="Member Portal"
          showQuotes={false}
        >
          <div className="space-y-4 mb-6">
            {trustPoints.map((point) => (
              <div key={point.title} className="flex items-start gap-3.5 group">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/15 transition-colors">
                  <point.icon className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{point.title}</p>
                  <p className="text-white/45 text-xs mt-0.5 leading-relaxed">{point.description}</p>
                </div>
              </div>
            ))}
          </div>
        </AuthHeroPanel>
      }
    >
      <div
        className={`space-y-8 transition-all duration-500 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="text-center lg:text-left">
          <Link href="/" className="inline-flex items-center mb-6 lg:hidden">
            <BrandLogo variant="full" size="md" tone="white" />
          </Link>
          <Link href="/" className="hidden lg:inline-flex items-center mb-6">
            <BrandLogo variant="full" size="lg" tone="white" priority />
          </Link>
          <h2 className={authForm.title}>Welcome back</h2>
          <p className={authForm.subtitle}>Sign in to your account to continue.</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-6">
          {error && (
            <div className={`${authForm.error} flex items-start gap-3`}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isLockedOut && (
            <div className="flex items-center gap-3 p-3.5 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>
                Account temporarily locked. Try again in{' '}
                <span className="font-semibold tabular-nums">{lockoutSeconds}s</span>
              </span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="signin-email" className={authForm.label}>Email address</label>
              <div className="relative group">
                <div className={authForm.inputGlow} />
                <Mail className={authForm.inputIcon} />
                <input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  disabled={isLockedOut}
                  className={`${authForm.input} disabled:opacity-50`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="signin-password" className={authForm.label}>Password</label>
                <Link href="/reset-password" className={authForm.link}>Forgot password?</Link>
              </div>
              <div className="relative group">
                <div className={authForm.inputGlow} />
                <Lock className={authForm.inputIcon} />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  disabled={isLockedOut}
                  className={`${authForm.input} pr-12 disabled:opacity-50`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 z-10"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className={authForm.submitBtn} disabled={loading || isLockedOut}>
            <div className={authForm.submitShimmer} />
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          <div className="pt-4 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm">
              Are you an agent?{' '}
              <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Register here
              </Link>
            </p>
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              <span>SSL Secured</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-600" />
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-cyan-400" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-600" />
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-cyan-400" />
              <span>Encrypted</span>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500">
            By signing in you agree to our{' '}
            <Link href="/terms" className="text-cyan-400 hover:underline">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-cyan-400 hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
