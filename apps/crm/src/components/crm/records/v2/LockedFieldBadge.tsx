'use client';

/**
 * LockedFieldBadge — tiny avatar + tooltip chip rendered next to a
 * field display when another user is currently editing it. Used by the
 * inline editors so the locked-out state is visually identical across
 * text / select / date / boolean variants.
 */

import { memo } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { RecordPresenceEntry } from '@/hooks/useRecordPresence';

export interface LockedFieldBadgeProps {
  owner: RecordPresenceEntry;
  className?: string;
  /** When true, render a full lock pill with name; otherwise compact. */
  verbose?: boolean;
}

function initials(name: string | null, email: string | null): string {
  const source = (name && name.trim()) || (email && email.split('@')[0]) || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export const LockedFieldBadge = memo(function LockedFieldBadge({
  owner,
  className,
  verbose = false,
}: LockedFieldBadgeProps) {
  const label =
    owner.fullName || owner.email || 'Someone else';
  const tooltip = `${label} is editing this field`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full',
        'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
        'ring-1 ring-amber-200/70 dark:ring-amber-500/20',
        verbose ? 'pl-0.5 pr-2 py-0.5' : 'p-0.5',
        className,
      )}
      title={tooltip}
      aria-label={tooltip}
      data-no-hotkeys
    >
      {owner.avatarUrl ? (
        <img
          src={owner.avatarUrl}
          alt=""
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 text-[9px] font-semibold text-amber-900 dark:bg-amber-500/30 dark:text-amber-100">
          {initials(owner.fullName, owner.email)}
        </span>
      )}
      {verbose ? (
        <span className="text-[11px] font-medium leading-none">
          {label.split(' ')[0]} is editing
        </span>
      ) : (
        <Lock className="h-2.5 w-2.5" aria-hidden />
      )}
    </span>
  );
});
