'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, ArrowLeft, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { authForm } from './auth-form-styles';
import { AuthFormError } from './auth-form-error';
import { AuthFormHeader } from './auth-form-header';
import { AuthSuccessPanel } from './auth-success-panel';

export interface AuthUpdatePasswordFormProps {
  backHref: string;
  homeHref?: string;
  onUpdatePassword: (password: string) => Promise<{ error: Error | null }>;
  onSessionReady?: () => Promise<boolean>;
}

/**
 * VISUAL REDESIGN ONLY.
 *
 * Unchanged, deliberately: the session-ready effect and its cancellation, the
 * `password.length < 8` rule, the `password !== confirmPassword` rule, both
 * error strings, the field ids (`new-password`, `confirm-password`),
 * `minLength={8}`, `autoComplete="new-password"`, the shared show/hide state,
 * the submit handler, the success switch, and every string of copy — the
 * password rule text is security-relevant and was not touched.
 *
 * The diff is the class map, the error box announcing itself, the show/hide
 * control getting a real 44px hit area (it was a bare 20px icon), and the
 * verifying state no longer being painted `text-cyan-400` / `text-slate-400`
 * — both of which came from the console Tailwind remap, not the brand.
 */
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
        <div className="py-8 text-center" role="status" aria-live="polite">
          <Loader2
            className="mx-auto mb-4 h-8 w-8 animate-spin text-[var(--auth-tone)]"
            aria-hidden="true"
          />
          <p className={authForm.subtitle}>Verifying your reset link...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <AuthFormError>{error}</AuthFormError>}

          <div className="space-y-2">
            <label htmlFor="new-password" className={authForm.label}>
              New password
            </label>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Lock className={authForm.inputIcon} aria-hidden="true" />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                className={`${authForm.input} pr-14`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={authForm.fieldAffix}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className={authForm.label}>
              Confirm password
            </label>
            <div className="group relative">
              <div className={authForm.inputGlow} />
              <Lock className={authForm.inputIcon} aria-hidden="true" />
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
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Updating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Update password
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </button>

          <div className="text-center">
            <Link href={backHref} className={authForm.link}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
