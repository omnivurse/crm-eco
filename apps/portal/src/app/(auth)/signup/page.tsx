'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { AuthFormHeader, AuthSuccessPanel, authForm } from '@crm-eco/ui';

const LEGAL_BASE = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://doublehelixhub.com';

export default function AgentSignUpPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            user_type: 'agent',
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
    }

    setLoading(false);
  };

  if (success) {
    return (
      <AuthSuccessPanel
        title="Registration submitted"
        description="Thank you for registering as an agent. Check your email to verify your account. An administrator will review and activate your access."
        primaryHref="/signin"
        primaryLabel="Go to sign in"
        showPrimaryArrow
      />
    );
  }

  return (
    <div className="space-y-8">
      <AuthFormHeader
        title="Become an agent"
        subtitle="Register to start earning commissions on enrollments."
      />

      <form onSubmit={handleSignUp} className="space-y-5">
        {error && <div className={authForm.error}>{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="firstName" className={authForm.label}>First name</label>
            <div className="relative group">
              <div className={authForm.inputGlow} />
              <User className={authForm.inputIcon} />
              <input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder="John"
                required
                className={authForm.input}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="lastName" className={authForm.label}>Last name</label>
            <input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              placeholder="Doe"
              required
              className={authForm.input}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className={authForm.label}>Email address</label>
          <div className="relative group">
            <div className={authForm.inputGlow} />
            <Mail className={authForm.inputIcon} />
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="you@example.com"
              required
              className={authForm.input}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className={authForm.label}>Phone (optional)</label>
          <div className="relative group">
            <div className={authForm.inputGlow} />
            <Phone className={authForm.inputIcon} />
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="(555) 123-4567"
              className={authForm.input}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className={authForm.label}>Password</label>
          <div className="relative group">
            <div className={authForm.inputGlow} />
            <Lock className={authForm.inputIcon} />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="Minimum 8 characters"
              required
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
          <label htmlFor="confirmPassword" className={authForm.label}>Confirm password</label>
          <div className="relative group">
            <div className={authForm.inputGlow} />
            <Lock className={authForm.inputIcon} />
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              placeholder="Re-enter your password"
              required
              className={authForm.input}
            />
          </div>
        </div>

        <button type="submit" className={authForm.submitBtn} disabled={loading}>
          <div className={authForm.submitShimmer} />
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating account...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Create account
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </button>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/signin" className="text-cyan-400 hover:text-cyan-300 font-medium">
            Sign in
          </Link>
        </p>
      </form>

      <p className="text-center text-xs text-slate-500">
        By signing up you agree to our{' '}
        <a href={`${LEGAL_BASE}/legal/terms`} className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">Terms</a>
        {' '}and{' '}
        <a href={`${LEGAL_BASE}/legal/privacy`} className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      </p>
    </div>
  );
}
