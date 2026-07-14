import * as React from 'react';
import { cn } from '../lib/utils';

/**
 * Semantic status colour system — shared across every app (CRM, Admin, Member
 * Portal). One hue = one meaning, everywhere. Colours come from the `--tone-*`
 * tokens defined in `@crm-eco/ui/styles/theme.css` (light + dark). Route every
 * status / stage / priority pill through <StatusBadge> + statusToTone() so the
 * same state never renders in two different colours across the suite.
 */
export type Tone =
  | 'neutral'
  | 'info'
  | 'progress'
  | 'attention'
  | 'success'
  | 'danger'
  | 'special'
  | 'brand';

const TONE_CLASS: Record<Tone, string> = {
  neutral:
    'text-[var(--tone-neutral-fg)] bg-[var(--tone-neutral-bg)] border-[var(--tone-neutral-border)]',
  info: 'text-[var(--tone-info-fg)] bg-[var(--tone-info-bg)] border-[var(--tone-info-border)]',
  progress:
    'text-[var(--tone-progress-fg)] bg-[var(--tone-progress-bg)] border-[var(--tone-progress-border)]',
  attention:
    'text-[var(--tone-attention-fg)] bg-[var(--tone-attention-bg)] border-[var(--tone-attention-border)]',
  success:
    'text-[var(--tone-success-fg)] bg-[var(--tone-success-bg)] border-[var(--tone-success-border)]',
  danger:
    'text-[var(--tone-danger-fg)] bg-[var(--tone-danger-bg)] border-[var(--tone-danger-border)]',
  special:
    'text-[var(--tone-special-fg)] bg-[var(--tone-special-bg)] border-[var(--tone-special-border)]',
  // Brand is reserved for interactive/brand emphasis only — never a status.
  brand: 'text-primary bg-primary/10 border-primary/30',
};

/**
 * Canonical status → tone map. Keys are normalised (lowercased,
 * non-alphanumerics stripped). Anything unmapped falls back to `neutral`.
 */
const STATUS_TONE: Record<string, Tone> = {
  // lifecycle / generic
  new: 'info',
  open: 'info',
  active: 'success',
  inactive: 'neutral',
  draft: 'neutral',
  archived: 'neutral',
  pending: 'attention',
  inprogress: 'progress',
  onhold: 'attention',
  blocked: 'danger',
  completed: 'success',
  done: 'success',
  cancelled: 'neutral',
  canceled: 'neutral',
  // leads
  prospect: 'info',
  hotprospectreadytomove: 'attention',
  contacted: 'progress',
  working: 'progress',
  nurturing: 'progress',
  qualified: 'success',
  unqualified: 'neutral',
  converted: 'success',
  // deals / pipeline
  won: 'success',
  closedwon: 'success',
  lost: 'danger',
  closedlost: 'danger',
  negotiation: 'attention',
  proposal: 'progress',
  // tickets / support
  resolved: 'success',
  closed: 'neutral',
  reopened: 'attention',
  escalated: 'danger',
  waiting: 'attention',
  // priority / urgency
  low: 'neutral',
  medium: 'info',
  normal: 'info',
  high: 'attention',
  urgent: 'danger',
  critical: 'danger',
  // approvals / enrollments / billing
  approved: 'success',
  rejected: 'danger',
  submitted: 'info',
  terminated: 'neutral',
  paused: 'attention',
  delinquent: 'danger',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
  success: 'success',
  processing: 'progress',
  // invoices
  sent: 'info',
  partial: 'attention',
  overdue: 'danger',
  pastdue: 'danger',
  void: 'neutral',
  uncollectible: 'danger',
};

const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Map a raw status/stage/priority string to its canonical tone. */
export function statusToTone(status?: string | null): Tone {
  if (!status) return 'neutral';
  return STATUS_TONE[normalize(status)] ?? 'neutral';
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Raw status/stage/priority string; mapped to a tone automatically. */
  status?: string | null;
  /** Force a specific tone (overrides the status → tone lookup). */
  tone?: Tone;
  /** Show a leading dot. Default true. */
  dot?: boolean;
  /** Visible label; defaults to the status string. */
  label?: React.ReactNode;
  size?: 'sm' | 'md';
}

/**
 * Consistent, theme-aware status pill. Give it a `status` and it colours
 * itself from the canonical map; or pass an explicit `tone`.
 *
 *   <StatusBadge status={member.status} />
 *   <StatusBadge tone="success" label="Paid" />
 */
export function StatusBadge({
  status,
  tone,
  dot = true,
  label,
  size = 'md',
  className,
  ...props
}: StatusBadgeProps): React.JSX.Element {
  const resolved = tone ?? statusToTone(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium leading-none whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        TONE_CLASS[resolved],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {label ?? status ?? '—'}
    </span>
  );
}
