import Link from 'next/link';
import {
  Phone,
  Mail,
  StickyNote,
  ArrowUpRight,
  CheckSquare,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { PeopleQueueAction, PeopleQueueItem } from '@/lib/dashboard/people-queue-types';
import { StatusBadge } from '@/components/ui/status-badge';
import { statusToneForValue, withReturnTo } from '@/lib/crm/status-lanes';
import { initialsFor, mailtoHref, recordHref, telHref } from './command-desk-format';

/* ------------------------------------------------------------------ */
/*  Back-to-dashboard: every desk → record link carries ?returnTo=/crm  */
/* ------------------------------------------------------------------ */

/** Dashboard record links return to `/crm` (RecordDetailShellV2 adds the Dashboard crumb). */
export const DESK_RETURN_TO = '/crm';

/** `/crm/r/<id>[?pane=…]` → same href with `returnTo=/crm` appended. */
export function deskHref(href: string): string {
  return withReturnTo(href, DESK_RETURN_TO);
}

/* ------------------------------------------------------------------ */
/*  Status pill — lane tone (lib/crm/status-lanes), the SAME colour     */
/*  RecordTable / ListView / the record header paint for a status.      */
/* ------------------------------------------------------------------ */

export function StatusPill({ status, className }: { status: string | null; className?: string }) {
  if (!status) {
    return <span className={cn('text-xs italic text-muted-foreground', className)}>No status</span>;
  }
  return (
    <StatusBadge
      status={status}
      tone={statusToneForValue(status)}
      size="sm"
      title={status}
      className={cn('max-w-full leading-4', className)}
      label={<span className="min-w-0 truncate">{status}</span>}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Avatar tile — accent follows market lane (see crm-lane-badges)      */
/* ------------------------------------------------------------------ */

const MARKET_TILE: Record<string, string> = {
  healthshare: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  traditional_insurance: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
};

export function AvatarTile({
  name,
  initials,
  marketType,
  size = 'sm',
}: {
  name: string;
  initials: string | null | undefined;
  marketType: string | null;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold',
        size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-10 w-10 text-sm',
        MARKET_TILE[marketType ?? ''] ?? 'bg-primary/10 text-primary',
      )}
    >
      {initialsFor(name, initials)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Next-action icon                                                   */
/* ------------------------------------------------------------------ */

export const ACTION_ICONS: Record<PeopleQueueAction['kind'], LucideIcon> = {
  call: Phone,
  email: Mail,
  note: StickyNote,
  task: CheckSquare,
  open: ArrowUpRight,
  review: Eye,
};

export function NextActionLink({
  action,
  className,
  compact = false,
}: {
  action: PeopleQueueAction;
  className?: string;
  compact?: boolean;
}) {
  const Icon = ACTION_ICONS[action.kind] ?? ArrowUpRight;
  return (
    <Link
      href={deskHref(action.href)}
      title={action.label}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md text-xs font-medium text-primary hover:underline',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact ? 'py-0.5' : 'px-1 py-0.5',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{action.label}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick actions: Open / Call / Email / Note                          */
/* ------------------------------------------------------------------ */

const ICON_BTN =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors ' +
  'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const ICON_BTN_DISABLED = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 cursor-not-allowed';

type QuickActionItem = Pick<PeopleQueueItem, 'recordId' | 'name' | 'phone' | 'email' | 'href'>;

/**
 * Icon-only quick actions. Call/Email render as disabled placeholders when
 * the record has no phone/email so columns stay aligned. Note deep-links to
 * the record page Notes pane with the composer open (`?pane=notes&compose=1`).
 */
export function QuickActions({
  item,
  showOpen = true,
  className,
}: {
  item: QuickActionItem;
  showOpen?: boolean;
  className?: string;
}) {
  const tel = telHref(item.phone);
  const mailto = mailtoHref(item.email);
  const open = deskHref(item.href || recordHref(item.recordId));
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {showOpen ? (
        <Link href={open} className={ICON_BTN} aria-label={`Open ${item.name}`} title="Open record">
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
      {tel ? (
        <a href={tel} className={ICON_BTN} aria-label={`Call ${item.name}`} title={`Call ${item.phone}`}>
          <Phone className="h-4 w-4" aria-hidden />
        </a>
      ) : (
        <span className={ICON_BTN_DISABLED} role="img" aria-label="No phone on file" title="No phone on file">
          <Phone className="h-4 w-4" aria-hidden />
        </span>
      )}
      {mailto ? (
        <a href={mailto} className={ICON_BTN} aria-label={`Email ${item.name}`} title={`Email ${item.email}`}>
          <Mail className="h-4 w-4" aria-hidden />
        </a>
      ) : (
        <span className={ICON_BTN_DISABLED} role="img" aria-label="No email on file" title="No email on file">
          <Mail className="h-4 w-4" aria-hidden />
        </span>
      )}
      <Link
        href={deskHref(recordHref(item.recordId, { pane: 'notes', compose: true }))}
        className={ICON_BTN}
        aria-label={`Add a note for ${item.name}`}
        title="Add note"
      >
        <StickyNote className="h-4 w-4" aria-hidden />
      </Link>
    </span>
  );
}
