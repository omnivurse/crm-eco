'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { authForm } from './auth-form-styles';
import { AuthFormHeader } from './auth-form-header';
import { AuthSuccessPanel } from './auth-success-panel';

export interface AuthResetPasswordFormProps {
  backHref: string;
  homeHref?: string;
  onResetPassword: (email: string) => Promise<{ error: Error | null }>;
}

export function AuthResetPasswordForm({
  backHref,
  homeHref = '/',
  onResetPassword,
}: AuthResetPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await onResetPassword(email.trim().toLowerCase());

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess(true);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <AuthSuccessPanel
        title="Check your email"
        description={
          <>
            We sent a password reset link to <strong className="text-slate-200">{email}</strong>.
            Click the link in the email to set a new password.
          </>
        }
        primaryHref={backHref}
        primaryLabel="Back to sign in"
      />
    );
  }

  return (
    <div className="space-y-8">
      <AuthFormHeader
        homeHref={homeHref}
        title="Reset password"
        subtitle="Enter your email and we'll send you a reset link."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className={authForm.error}>{error}</div>}

        <div className="space-y-2">
          <label htmlFor="reset-email" className={authForm.label}>
            Email address
          </label>
          <div className="relative group">
            <div className={authForm.inputGlow} />
            <Mail className={authForm.inputIcon} />
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className={authForm.input}
            />
          </div>
        </div>

        <button type="submit" className={authForm.submitBtn} disabled={loading}>
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Send reset link
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
    </div>
  );
}
