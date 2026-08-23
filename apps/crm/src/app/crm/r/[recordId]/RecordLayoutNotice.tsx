'use client';

/**
 * RP-M2 — the record page never fails open silently.
 *
 *   kind="error"   the default-layout fetch rejected (transient): inline banner
 *                  in the toastCopy voice with a working Retry (router.refresh).
 *   kind="missing" the module has no default layout row (configuration):
 *                  empty-state notice naming the module, pointing admins to
 *                  Settings → Layouts.
 *
 * In both cases the V2 shell and the one-section field form still render
 * underneath (DynamicRecordForm's 'main' fallback) — nothing is hidden.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, LayoutTemplate, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { toastCopy } from '@/lib/crm/toast-copy';

export type RecordLayoutNoticeKind = 'error' | 'missing';

export interface RecordLayoutNoticeProps {
  kind: RecordLayoutNoticeKind;
  /** Module display name (plural preferred), e.g. "Contacts". */
  moduleName: string;
  className?: string;
}

/** Copy lives here so the unit test and the page share one source. */
export function recordLayoutNoticeCopy(kind: RecordLayoutNoticeKind, moduleName: string) {
  if (kind === 'error') {
    return {
      title: toastCopy.failed("load this record's layout"),
      description: 'Fields are shown in one section until it loads.',
      action: 'Retry',
    };
  }
  return {
    title: `No default layout for ${moduleName}`,
    description:
      'Fields are shown in one section. An admin can set a default layout in Settings → Layouts.',
    action: 'Open Layouts',
  };
}

export function RecordLayoutNotice({ kind, moduleName, className }: RecordLayoutNoticeProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [retries, setRetries] = useState(0);
  const copy = recordLayoutNoticeCopy(kind, moduleName);
  const isError = kind === 'error';
  const Icon = isError ? AlertTriangle : LayoutTemplate;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      data-testid={`crm-record-layout-notice-${kind}`}
      className={[
        'mb-3 flex items-start gap-3 rounded-lg border px-4 py-3',
        isError
          ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5'
          : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5',
        className ?? '',
      ].join(' ')}
    >
      <Icon
        className={[
          'mt-0.5 h-4 w-4 shrink-0',
          isError ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500',
        ].join(' ')}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p
          className={[
            'text-sm font-medium',
            isError ? 'text-amber-800 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200',
          ].join(' ')}
        >
          {copy.title}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{copy.description}</p>
      </div>
      {isError ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          aria-busy={isPending || undefined}
          onClick={() => {
            setRetries((n) => n + 1);
            startTransition(() => router.refresh());
          }}
          className="shrink-0"
          data-retries={retries}
        >
          {isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {copy.action}
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/crm/settings/layouts">{copy.action}</Link>
        </Button>
      )}
    </div>
  );
}
