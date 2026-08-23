'use client';

/**
 * MobileActionBar — sticky bottom bar shown only on narrow viewports.
 *
 * Promotes the four highest-value rep actions (Call, Email, Note, more
 * ⋯) above the fold on phones, where the desktop header button cluster
 * would either wrap or get buried behind the ⋯ overflow menu.
 *
 * Callbacks are thin wrappers around the handlers that already live on
 * `RecordDetailShellV2` — no new modals or flows are introduced here.
 */

import { memo } from 'react';
import { Phone, Mail, StickyNote, Sparkles } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { CallLink } from '@/components/crm/records/CallLink';

export interface MobileActionBarProps {
  /**
   * TE-8: when set, Call renders as a real `tel:` anchor (CallLink) so the
   * OS dialer opens without a JS redirect; `onCall` is then only the
   * no-phone fallback (e.g. open the "log a call" task modal).
   */
  phone?: string | null;
  onCall?: () => void;
  onEmail?: () => void;
  onNote?: () => void;
  onMore?: () => void;
  hasPhone?: boolean;
  hasEmail?: boolean;
  /** Label for the 4th slot — defaults to "Insights". */
  moreLabel?: string;
  className?: string;
}

export const MobileActionBar = memo(function MobileActionBar({
  phone = null,
  onCall,
  onEmail,
  onNote,
  onMore,
  hasPhone = true,
  hasEmail = true,
  moreLabel = 'Insights',
  className,
}: MobileActionBarProps) {
  return (
    <nav
      aria-label="Quick actions"
      className={cn(
        // Bottom-fixed on narrow viewports; invisible on desktop where the
        // header buttons + right rail already cover these actions.
        'lg:hidden fixed bottom-0 inset-x-0 z-30',
        'border-t border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950',
        'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <div className="grid grid-cols-4 divide-x divide-slate-200 dark:divide-white/5">
        <ActionButton
          icon={<Phone className="w-5 h-5" />}
          label="Call"
          onClick={onCall}
          href={phone ? { phone } : undefined}
          disabled={!hasPhone}
        />
        <ActionButton
          icon={<Mail className="w-5 h-5" />}
          label="Email"
          onClick={onEmail}
          disabled={!hasEmail}
          accent="text-rose-600 dark:text-rose-400"
        />
        <ActionButton
          icon={<StickyNote className="w-5 h-5" />}
          label="Note"
          onClick={onNote}
        />
        <ActionButton
          icon={<Sparkles className="w-5 h-5" />}
          label={moreLabel}
          onClick={onMore}
          accent="text-teal-600 dark:text-teal-400"
        />
      </div>
    </nav>
  );
});

function ActionButton({
  icon,
  label,
  onClick,
  href,
  disabled,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  /** Render as a `tel:` anchor (CallLink) instead of a button. */
  href?: { phone: string };
  disabled?: boolean;
  accent?: string;
}) {
  const className = cn(
    // RP-6: keep the bar shallow — every px here is taken from the one-glance
    // record content above it on a 390px-tall-budget phone screen.
    'flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium',
    disabled
      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
      : cn(
          'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 dark:active:bg-white/10 transition-colors',
          accent,
        ),
  );
  if (href && !disabled) {
    return (
      <CallLink
        phone={href.phone}
        className={className}
        aria-label={`${label} ${href.phone}`}
        data-testid="crm-mobile-bar-call"
        fallback={
          <button type="button" onClick={onClick} disabled={!onClick} className={className}>
            {icon}
            <span>{label}</span>
          </button>
        }
      >
        {icon}
        <span>{label}</span>
      </CallLink>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={className}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
