'use client';

/**
 * PERM-viewer-gated-link — the desk says why you were moved.
 *
 * A role gate elsewhere in the CRM (today: /crm/import, which is
 * crm_admin | crm_manager only) redirects to `/crm?error=<reason>`. Without a
 * reader, that redirect is silent: the viewer clicks a deep link and simply
 * finds themselves on the dashboard. This banner is the reader — one voice
 * (lib/crm/gate-notice-copy), announced politely on arrival, and dismissible
 * (dismissing also drops the param, so a refresh does not re-announce it).
 *
 * Unknown `?error=` values render NOTHING: the query is user-controlled and is
 * never echoed into the page.
 */

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, X } from 'lucide-react';
import { crmGateNoticeCopy } from '@/lib/crm/gate-notice-copy';

export interface DashboardGateNoticeProps {
  /** The raw `?error=` value from the dashboard's searchParams. */
  reason: string | string[] | null | undefined;
}

export function DashboardGateNotice({ reason }: DashboardGateNoticeProps) {
  const copy = crmGateNoticeCopy(reason);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => {
    setDismissed(true);
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.delete('error');
    const query = next.toString();
    router.replace(query ? `/crm?${query}` : '/crm', { scroll: false });
  }, [router, searchParams]);

  if (!copy || dismissed) return null;

  return (
    <div
      role="status"
      data-testid="crm-dashboard-gate-notice"
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/5"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{copy.title}</p>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{copy.description}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss this notice"
        data-testid="crm-dashboard-gate-notice-dismiss"
        className="shrink-0 rounded-md p-1 text-amber-700/70 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300/70 dark:hover:bg-amber-500/10 dark:hover:text-amber-200"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
