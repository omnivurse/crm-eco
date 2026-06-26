'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';

export default function SecurityPage() {
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (password.length < 8) {
      setPwMessage({ kind: 'err', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setPwMessage({ kind: 'err', text: 'Passwords do not match.' });
      return;
    }
    setPwSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPwSubmitting(false);
    if (error) {
      setPwMessage({ kind: 'err', text: error.message });
    } else {
      setPwMessage({ kind: 'ok', text: 'Password updated.' });
      setPassword('');
      setConfirm('');
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMessage(null);
    setEmailSubmitting(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSubmitting(false);
    if (error) {
      setEmailMessage({ kind: 'err', text: error.message });
    } else {
      setEmailMessage({
        kind: 'ok',
        text: 'Verification email sent. Click the link to finish updating your email.',
      });
      setNewEmail('');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link href="/profile" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Profile
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          Security
        </h1>
        <p className="mt-1 text-sm text-slate-600">Change your password or sign-in email.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Change password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="new-password"
            />
            {pwMessage && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  pwMessage.kind === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {pwMessage.text}
              </div>
            )}
            <button
              type="submit"
              disabled={pwSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pwSubmitting ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Change email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changeEmail} className="space-y-3">
            <input
              type="email"
              placeholder="new@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="email"
            />
            {emailMessage && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  emailMessage.kind === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {emailMessage.text}
              </div>
            )}
            <button
              type="submit"
              disabled={emailSubmitting || !newEmail}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {emailSubmitting ? 'Sending...' : 'Send verification email'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
