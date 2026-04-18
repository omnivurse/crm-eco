'use client';

/**
 * PresenceStack — compact avatar row showing other users currently on the
 * same record. Powered by `useRecordPresence`. Fits in the V2 shell
 * header next to the action buttons.
 *
 * Visual rules:
 *   - Up to 3 avatars are shown inline; additional participants collapse
 *     into a "+N" tile.
 *   - Each avatar has a tooltip with the full name / email / intent.
 *   - `editing` intent gets a small pencil badge; `viewing` is the default.
 *   - Hidden entirely when there are zero other participants (so solo
 *     users don't see a stale empty widget).
 */

import { memo, useMemo } from 'react';
import { Pencil, Eye } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { RecordPresenceEntry } from '@/hooks/useRecordPresence';
import { resolveModulePalette } from './tokens';

export interface PresenceStackProps {
  participants: RecordPresenceEntry[];
  moduleKey?: string;
  max?: number;
  className?: string;
}

export const PresenceStack = memo(function PresenceStack({
  participants,
  moduleKey,
  max = 3,
  className,
}: PresenceStackProps) {
  const { visible, overflow } = useMemo(() => {
    if (participants.length <= max) {
      return { visible: participants, overflow: 0 };
    }
    return {
      visible: participants.slice(0, max),
      overflow: participants.length - max,
    };
  }, [participants, max]);

  if (participants.length === 0) return null;

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      aria-label={`${participants.length} other ${participants.length === 1 ? 'user' : 'users'} on this record`}
    >
      <div className="flex -space-x-2">
        {visible.map((p) => (
          <PresenceAvatar key={p.userId + p.presenceRef} entry={p} moduleKey={moduleKey} />
        ))}
        {overflow > 0 && (
          <div
            className="relative inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
            title={`${overflow} more ${overflow === 1 ? 'person' : 'people'}`}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
});

interface PresenceAvatarProps {
  entry: RecordPresenceEntry;
  moduleKey?: string;
}

function PresenceAvatar({ entry, moduleKey }: PresenceAvatarProps) {
  const displayName = entry.fullName || entry.email || 'Unknown';
  const initials = getInitials(displayName);
  const palette = resolveModulePalette(moduleKey, displayName);
  const intentLabel = entry.intent === 'editing' ? 'Editing' : 'Viewing';

  return (
    <div className="relative group">
      <div
        className={cn(
          'inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 text-[10px] font-semibold shadow-sm',
          palette.bg,
          palette.text,
        )}
        aria-hidden
      >
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.avatarUrl}
            alt=""
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {entry.intent === 'editing' ? (
        <span
          className="absolute -right-0.5 -bottom-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-500 text-white ring-2 ring-white dark:ring-slate-900"
          aria-hidden
        >
          <Pencil className="w-2 h-2" />
        </span>
      ) : (
        <span
          className="absolute -right-0.5 -bottom-0.5 inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
          aria-hidden
        />
      )}

      {/* Simple CSS-only tooltip. */}
      <div
        role="tooltip"
        className="pointer-events-none absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 dark:bg-slate-700 text-white px-2 py-1 text-[10px] opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all z-50 shadow-lg"
      >
        <div className="font-medium">{displayName}</div>
        <div className="flex items-center gap-1 text-slate-300">
          {entry.intent === 'editing' ? (
            <Pencil className="w-2.5 h-2.5" />
          ) : (
            <Eye className="w-2.5 h-2.5" />
          )}
          <span>{intentLabel}</span>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
