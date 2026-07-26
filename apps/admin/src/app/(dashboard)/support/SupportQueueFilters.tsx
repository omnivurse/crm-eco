'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Input, Label } from '@crm-eco/ui';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open / active' },
  { value: 'pending', label: 'Waiting on member' },
  { value: 'resolved', label: 'Resolved / closed' },
  { value: 'all', label: 'All' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export function SupportQueueFilters({
  status,
  priority,
  q,
}: {
  status: string;
  priority: string;
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const push = (next: { status?: string; priority?: string; q?: string }) => {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const p = next.priority ?? priority;
    const query = next.q ?? q;
    if (s && s !== 'open') params.set('status', s);
    else if (s === 'open') params.set('status', 'open');
    if (p && p !== 'all') params.set('priority', p);
    if (query.trim()) params.set('q', query.trim());
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-end ${
        pending ? 'opacity-70' : ''
      }`}
    >
      <div className="space-y-1.5">
        <Label htmlFor="support-status" className="text-xs text-slate-500">
          Status
        </Label>
        <select
          id="support-status"
          className="h-9 min-w-[160px] rounded-md border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          value={status}
          onChange={(e) => push({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="support-priority" className="text-xs text-slate-500">
          Priority
        </Label>
        <select
          id="support-priority"
          className="h-9 min-w-[160px] rounded-md border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
          value={priority}
          onChange={(e) => push({ priority: e.target.value })}
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[200px] flex-1 space-y-1.5">
        <Label htmlFor="support-q" className="text-xs text-slate-500">
          Search member or subject
        </Label>
        <Input
          id="support-q"
          defaultValue={q}
          placeholder="Search…"
          onChange={(e) => {
            const value = e.target.value;
            window.clearTimeout((window as unknown as { __supportQ?: number }).__supportQ);
            (window as unknown as { __supportQ?: number }).__supportQ = window.setTimeout(
              () => push({ q: value }),
              300,
            );
          }}
        />
      </div>
    </div>
  );
}
