'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, ArrowLeft, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { authForm } from './auth-form-styles';
import { AuthFormHeader } from './auth-form-header';
import { AuthSuccessPanel } from './auth-success-panel';

export interface AuthUpdatePasswordFormProps {
  backHref: string;
  homeHref?: string;
  onUpdatePassword: (password: string) => Promise<{ error: Error | null }>;
  onSessionReady?: () => Promise<boolean>;
}

export function AuthUpdatePasswordForm({
  backHref,
  homeHref = '/',
  onUpdatePassword,
  onSessionReady,
}: AuthUpdatePasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      if (onSessionReady) {
        const ready = await onSessionReady();
        if (!cancelled) setSessionReady(ready);
        return;
      }
      if (!cancelled) setSessionReady(true);
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [onSessionReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error: updateError } = await onUpdatePassword(password);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <AuthSuccessPanel
        title="Password updated"
        description="Your password has been updated. You can now sign in with your new password."
        primaryHref={backHref}
        primaryLabel="Sign in"
        showPrimaryArrow
      />
    );
  }

  return (
    <div className="space-y-8">
      <AuthFormHeader
        homeHref={homeHref}
        title="Set new password"
        subtitle="Choose a strong password for your account."
      />

      {!sessionReady ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Verifying your reset link...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className={authForm.error}>{error}</div>}

          <div className="space-y-2">
            <label htmlFor="new-password" className={authForm.label}>
              New password
            </label>
            <div className="relative group">
              <div className={authForm.inputGlow} />
              <Lock className={authForm.inputIcon} />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                className={`${authForm.input} pr-12`}
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

          <div className="space-y-2">
            <label htmlFor="confirm-password" className={authForm.label}>
              Confirm password
            </label>
            <div className="relative group">
              <div className={authForm.inputGlow} />
              <Lock className={authForm.inputIcon} />
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
                autoComplete="new-password"
                className={authForm.input}
              />
            </div>
          </div>

          <button type="submit" className={authForm.submitBtn} disabled={loading}>
            <div className={authForm.submitShimmer} />
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Update password
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>

          <div className="text-center">
            <Link href={backHref} className={`${authForm.link} inline-flex items-center gap-1`}>
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
