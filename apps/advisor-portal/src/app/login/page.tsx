'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleNotch, Lock, Eye, EyeSlash, Envelope } from '@phosphor-icons/react';
import { AuthSplitLayout, AuthHeroPanel, BrandLogo, authForm } from '@crm-eco/ui';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const errorParam = searchParams.get('error');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  const displayError =
    error || (errorParam === 'no_advisor_access' ? 'You do not have advisor access.' : errorParam ? 'An error occurred.' : null);

  return (
    <div className="space-y-8">
      <div className="text-center lg:text-left">
        <Link href="/" className="mb-6 inline-flex items-center">
          <BrandLogo variant="full" size="lg" tone="white" priority />
        </Link>
        <h2 className={authForm.title}>Advisor Portal</h2>
        <p className={authForm.subtitle}>Sign in to access your dashboard</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {displayError && <div className={authForm.error}>{displayError}</div>}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className={authForm.label}>Email Address</label>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Envelope weight="light" className={authForm.inputIcon} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                className={authForm.input}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={authForm.label}>Password</label>
              <Link href="/reset-password" className={authForm.link}>Forgot password?</Link>
            </div>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Lock weight="light" className={authForm.inputIcon} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className={`${authForm.input} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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

        <button type="submit" disabled={loading} className={authForm.submitBtn}>
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <CircleNotch weight="light" className="h-5 w-5 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              Sign In
              <span className="ml-2 transition-transform group-hover:translate-x-1">&rarr;</span>
            </span>
          )}
        </button>
      </form>

      <p className={authForm.footer}>Need help? Contact your administrator</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthSplitLayout
      variant="crm"
      hero={
        <AuthHeroPanel
          variant="crm"
          headline={
            <>
              <span className="block">Grow your</span>
              <span className="block bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                advisor practice
              </span>
            </>
          }
          subtitle="Leads, presentations, and your team — one Ethereal Glass workspace."
          badge="Advisor Portal"
        />
      }
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <CircleNotch weight="light" className="h-8 w-8 animate-spin text-[var(--adv-teal,#0b6d85)]" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
