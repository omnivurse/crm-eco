'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Heart,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mail,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { readInviteToken } from '@/lib/team/invite-token';

interface InvitationDetails {
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
}

type PageState = 'loading' | 'unauthenticated' | 'check-email' | 'email-mismatch' | 'ready' | 'signup' | 'accepting' | 'success' | 'error';

export default function AcceptInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);

  // Query first (new mail), then hash (already-sent mail).
  useEffect(() => {
    setToken(readInviteToken(window.location.search, window.location.hash));
  }, []);

  const [state, setState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailMatch, setEmailMatch] = useState<boolean | null>(null);

  // Sign-up form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  const validateToken = useCallback(async (t: string) => {
    try {
      const res = await fetch(`/api/team/invite/accept?token=${encodeURIComponent(t)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid invitation');
        setState('error');
        return;
      }

      setInvitation(data.invitation);
      setIsAuthenticated(data.isAuthenticated);
      setEmailMatch(data.emailMatch);

      if (!data.isAuthenticated) {
        setSignupEmail(data.invitation.email);
        setState('unauthenticated');
      } else if (data.emailMatch === false) {
        setState('email-mismatch');
      } else {
        setState('ready');
      }
    } catch {
      setError('Failed to validate invitation');
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (token === undefined) return; // Not yet read from hash
    if (token) {
      validateToken(token);
    } else {
      setError('No invitation token provided');
      setState('error');
    }
  }, [token, validateToken]);

  async function handleSignUp() {
    setSignupLoading(true);
    setError('');
    try {
      // Use server-side signup API that bypasses enable_signup=false
      // The server validates the invite token before creating the account
      const res = await fetch('/api/team/invite/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: signupPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Sign up failed');
        setSignupLoading(false);
        return;
      }

      if (data.needsSignIn) {
        // Account created but couldn't auto-sign-in — sign in manually
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: signupEmail,
          password: signupPassword,
        });
        if (signInError) {
          setError('Account created but sign-in failed. Please try signing in.');
          setSignupLoading(false);
          return;
        }
      } else if (data.session) {
        // Set the session from the server response
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      // Re-validate after signup (user is now authenticated)
      if (token) await validateToken(token);
    } catch {
      setError('Sign up failed');
    } finally {
      setSignupLoading(false);
    }
  }

  async function handleSignIn() {
    setSignupLoading(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signupEmail,
        password: signupPassword,
      });

      if (signInError) {
        setError(signInError.message);
        setSignupLoading(false);
        return;
      }

      // Re-validate after sign in
      if (token) await validateToken(token);
    } catch {
      setError('Sign in failed');
    } finally {
      setSignupLoading(false);
    }
  }

  async function handleAccept() {
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    setState('accepting');
    setError('');

    try {
      const res = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fullName: fullName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation');
        setState('ready');
        return;
      }

      setState('success');
      setTimeout(() => router.push('/crm'), 2000);
    } catch {
      setError('Failed to accept invitation');
      setState('ready');
    }
  }

  function formatRole(role: string) {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <Heart className="w-7 h-7 text-white" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-8">
          {/* Loading */}
          {state === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-500 mb-3" />
              <p className="text-slate-500">Validating invitation...</p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Invalid Invitation
              </h2>
              <p className="text-slate-500 mb-6">{error}</p>
              <Button variant="outline" onClick={() => router.push('/crm-login')}>
                Go to Login
              </Button>
            </div>
          )}

          {/* Check email — signup succeeded but needs email confirmation */}
          {state === 'check-email' && invitation && (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 mx-auto text-teal-500 mb-4" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Check Your Email
              </h2>
              <p className="text-slate-500 mb-2">
                We sent a confirmation link to <strong>{signupEmail}</strong>.
              </p>
              <p className="text-sm text-slate-400 mb-6">
                Click the link in the email to confirm your account, then return here to accept your invitation to <strong>{invitation.organizationName}</strong>.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setState('unauthenticated');
                  setError('');
                }}
              >
                Back to Sign In
              </Button>
            </div>
          )}

          {/* Unauthenticated — sign up or sign in */}
          {state === 'unauthenticated' && invitation && (
            <div>
              <div className="text-center mb-6">
                <Mail className="w-10 h-10 mx-auto text-teal-500 mb-3" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  You&apos;re Invited
                </h2>
                <p className="text-slate-500 mt-1">
                  Join <strong>{invitation.organizationName}</strong> as{' '}
                  <strong>{formatRole(invitation.role)}</strong>
                </p>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">
                Sign in or create an account with <strong>{invitation.email}</strong> to accept.
              </p>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={signupEmail}
                    disabled
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 mt-3">{error}</p>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleSignIn}
                  disabled={signupLoading || !signupPassword}
                >
                  {signupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Sign In
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleSignUp}
                  disabled={signupLoading || !signupPassword}
                >
                  {signupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Sign Up
                </Button>
              </div>
            </div>
          )}

          {/* Email mismatch */}
          {state === 'email-mismatch' && invitation && (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Email Mismatch
              </h2>
              <p className="text-slate-500 mb-4">
                This invitation was sent to <strong>{invitation.email}</strong>, but you&apos;re
                signed in with a different email.
              </p>
              <p className="text-sm text-slate-400 mb-6">
                Please sign out and sign in with <strong>{invitation.email}</strong>.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                }}
              >
                Sign Out
              </Button>
            </div>
          )}

          {/* Ready to accept */}
          {state === 'ready' && invitation && (
            <div>
              <div className="text-center mb-6">
                <UserPlus className="w-10 h-10 mx-auto text-teal-500 mb-3" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Accept Invitation
                </h2>
                <p className="text-slate-500 mt-1">
                  Join <strong>{invitation.organizationName}</strong> as{' '}
                  <strong>{formatRole(invitation.role)}</strong>
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Your Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAccept()}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 mt-3">{error}</p>
              )}

              <Button
                className="w-full mt-6 gap-2"
                onClick={handleAccept}
                disabled={!fullName.trim()}
              >
                <CheckCircle className="w-4 h-4" />
                Accept & Join
              </Button>
            </div>
          )}

          {/* Accepting */}
          {state === 'accepting' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-500 mb-3" />
              <p className="text-slate-500">Joining organization...</p>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Welcome Aboard!
              </h2>
              <p className="text-slate-500">
                Redirecting to your dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
