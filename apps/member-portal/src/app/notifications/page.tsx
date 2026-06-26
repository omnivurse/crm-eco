'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, ChevronLeft, CheckCheck, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@crm-eco/ui';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  priority: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/member/notifications');
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Defer out of the synchronous effect body (refresh sets loading state) — the
    // same on-mount fetch pattern used by the profile/documents pages.
    queueMicrotask(() => refresh());
  }, [refresh]);

  async function markAllRead() {
    setMarking(true);
    await fetch('/api/member/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    setMarking(false);
    refresh();
  }

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Bell className="h-6 w-6" />
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="text-slate-500">You don&apos;t have any notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Inner = (
              <div
                className={`rounded-xl border p-4 transition ${
                  n.is_read
                    ? 'border-slate-200 bg-white'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                      n.is_read ? 'bg-transparent' : 'bg-blue-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">{n.title}</p>
                      <span className="text-xs text-slate-500">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
                    {n.category && (
                      <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {n.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
            return n.action_url ? (
              <Link key={n.id} href={n.action_url} className="block">
                {Inner}
              </Link>
            ) : (
              <div key={n.id}>{Inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
