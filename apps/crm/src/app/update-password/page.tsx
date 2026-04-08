'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Lock, ArrowRight, Loader2, Check, Shield, Activity, Stethoscope } from 'lucide-react';
import Image from 'next/image';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
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

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Password Updated</h1>
          <p className="text-slate-600 mb-6">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <Link href="/crm-login">
            <Button className="gap-2">
              <ArrowRight className="h-4 w-4" />
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="Double Helix Hub"
              width={200}
              height={80}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-navy-800">
            Set New Password
          </h2>
          <p className="mt-2 text-brand-navy-500">
            Enter your new password below
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
          {!sessionReady ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">Verifying your reset link...</p>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-brand-navy-700 text-sm font-medium">
                  New Password
                </Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-teal-500/20 to-brand-emerald-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-navy-400 group-focus-within:text-brand-teal-600 transition-colors z-10" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    className="relative pl-12 h-14 bg-white border-brand-navy-200 text-brand-navy-900 placeholder:text-brand-navy-400 focus:border-brand-teal-500 focus:ring-brand-teal-500/20 rounded-xl transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-brand-navy-700 text-sm font-medium">
                  Confirm Password
                </Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-teal-500/20 to-brand-emerald-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-navy-400 group-focus-within:text-brand-teal-600 transition-colors z-10" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    minLength={8}
                    className="relative pl-12 h-14 bg-white border-brand-navy-200 text-brand-navy-900 placeholder:text-brand-navy-400 focus:border-brand-teal-500 focus:ring-brand-teal-500/20 rounded-xl transition-all shadow-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="relative w-full h-14 text-base font-semibold bg-gradient-to-r from-brand-teal-500 to-brand-emerald-500 hover:from-brand-teal-400 hover:to-brand-emerald-400 text-white border-0 rounded-xl transition-all overflow-hidden group"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    Update Password
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/crm-login"
              className="text-sm text-brand-teal-600 hover:text-brand-teal-700 inline-flex items-center gap-1 transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>

        {/* Security Badges */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
              <Lock className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">256-bit Encryption</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-brand-teal-500" />
              MFA Protected
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5 text-brand-teal-500" />
              PHI Secure
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-brand-teal-500" />
              Audit Logging
            </span>
          </div>
          <p className="text-slate-400 text-xs text-center">
            &copy; 2026 Double Helix Hub. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
