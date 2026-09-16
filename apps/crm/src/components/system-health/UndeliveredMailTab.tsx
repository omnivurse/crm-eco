'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';

interface ParkedMail {
  id: string;
  source: string;
  error_category: string | null;
  error: string;
  created_at: string;
  organization_id: string | null;
  org_id: string | null;
  resolved_at: string | null;
}

export default function UndeliveredMailTab() {
  const [items, setItems] = useState<ParkedMail[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/comms/dead-letters');
      if (res.status === 401) {
        const expired = toastCopy.sessionExpired('/crm/settings/system-health?tab=mail');
        toast.error(expired.title, { description: expired.description });
        return;
      }
      if (!res.ok) {
        toast.error(toastCopy.failed('load parked mail', undefined, 'Try again'));
        return;
      }
      const data = (await res.json()) as { items?: ParkedMail[] };
      setItems(data.items ?? []);
    } catch {
      toast.error(toastCopy.failed('load parked mail', undefined, 'Try again'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markReviewed(row: ParkedMail) {
    const ok = await confirmDialog({
      title: 'Mark this message reviewed?',
      description:
        'This does not deliver the email. Use it for probes or after you have fixed the domain / routed the real mail another way.',
      confirmLabel: 'Mark reviewed',
    });
    if (!ok) return;

    setPendingId(row.id);
    try {
      const res = await fetch('/api/crm/comms/dead-letters', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, resolved: true }),
      });
      if (!res.ok) {
        toast.error(toastCopy.failed('mark the message reviewed', undefined, 'Try again'));
        return;
      }
      toast.success(toastCopy.updated('Parked message'));
      setItems((prev) => prev.filter((item) => item.id !== row.id));
    } catch {
      toast.error(toastCopy.failed('mark the message reviewed', undefined, 'Try again'));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/crm/settings/system-health">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to health checks
            </Link>
          </Button>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Parked inbound mail</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Mail we received but could not file in an inbox. Typical cause: the
            To: address is not a verified Email Domain. Fix the domain, or mark
            a probe reviewed so System Health goes green.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/crm/settings/email-domains">Email Domains</Link>
          </Button>
          <Button onClick={() => void load()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading parked mail…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Mail className="w-8 h-8 mx-auto mb-3 text-slate-400" />
          <p className="font-medium text-slate-900 dark:text-white">Queue is clear</p>
          <p className="text-sm text-slate-500 mt-1">
            No unresolved inbound messages. Reload System Health to refresh the
            check.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {row.error_category || 'unclassified'} · {row.source}
                    {row.organization_id || row.org_id ? '' : ' · no tenant (unroutable)'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white break-words">
                    {row.error}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId === row.id}
                  onClick={() => void markReviewed(row)}
                >
                  {pendingId === row.id ? 'Saving…' : 'Mark reviewed'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
