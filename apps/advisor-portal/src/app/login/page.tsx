'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Eye, EyeOff, Mail } from 'lucide-react';
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
        <Link href="/" className="inline-flex items-center mb-6">
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
            <div className="relative group">
              <div className={authForm.inputGlow} />
              <Mail className={authForm.inputIcon} />
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
            <div className="relative group">
              <div className={authForm.inputGlow} />
              <Lock className={authForm.inputIcon} />
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 z-10"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className={authForm.submitBtn}>
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              Sign In
              <span className="ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
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
      hero={
        <AuthHeroPanel
          headline={
            <>
              <span className="block">Grow your</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                Advisor Practice
              </span>
            </>
          }
          subtitle="Manage leads, presentations, and your team from one unified workspace."
          badge="Advisor Portal"
        />
      }
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
