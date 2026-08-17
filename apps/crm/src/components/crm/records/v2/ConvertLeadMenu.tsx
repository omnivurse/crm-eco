'use client';

/**
 * ConvertLeadMenu — the ONE "Convert…" control in the record header.
 *
 * Replaces the two side-by-side buttons ("Convert to Contact" + "Convert to
 * Member") that shared the same icon and explained each other in amber
 * paragraphs. Each item has its own icon and a one-line description; the
 * items open the existing dialogs (ConvertToContactDialog / ConvertLeadButton),
 * so the conversion paths themselves are unchanged.
 */

import { ArrowRightLeft, ChevronDown, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';

export interface ConvertLeadMenuProps {
  /** Show "Add as Contact" (CRM contact only, no enrollment). */
  canAddContact: boolean;
  /** Show "Enroll as Member" (member-system enrollment). */
  canEnroll: boolean;
  /** Market-aware label, e.g. "Enroll as Member" / "Convert to Client". */
  enrollLabel: string;
  /** Market-aware noun for the description, e.g. "member" / "insurance client". */
  enrollNoun: string;
  /** ISO start date; when in the future the contact path is called out as Pending. */
  effectiveStartDate?: string | null;
  onAddContact: () => void;
  onEnroll: () => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

function isFutureIsoDate(iso?: string | null): boolean {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1) > todayUtc;
}

export function ConvertLeadMenu({
  canAddContact,
  canEnroll,
  enrollLabel,
  enrollNoun,
  effectiveStartDate,
  onAddContact,
  onEnroll,
  size = 'sm',
  className,
}: ConvertLeadMenuProps) {
  if (!canAddContact && !canEnroll) return null;
  const futureStart = isFutureIsoDate(effectiveStartDate);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size={size}
          variant="outline"
          aria-label="Convert this lead"
          className={cn('inline-flex shrink-0 font-medium', className)}
        >
          <ArrowRightLeft className="w-4 h-4 shrink-0 sm:mr-1.5" aria-hidden />
          <span className="text-xs sm:text-sm">Convert</span>
          <ChevronDown className="ml-1 w-3.5 h-3.5 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
      >
        <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400">
          Convert this lead
        </DropdownMenuLabel>
        {canAddContact && (
          <DropdownMenuItem
            onSelect={() => onAddContact()}
            className="items-start gap-2.5 py-2 cursor-pointer"
          >
            <UserPlus className="mt-0.5 w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-white">
                Add as Contact
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {futureStart
                  ? `Track in Contacts as Pending until ${effectiveStartDate}. No enrollment.`
                  : 'Track them in Contacts. No enrollment.'}
              </span>
            </span>
          </DropdownMenuItem>
        )}
        {canAddContact && canEnroll && (
          <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
        )}
        {canEnroll && (
          <DropdownMenuItem
            onSelect={() => onEnroll()}
            className="items-start gap-2.5 py-2 cursor-pointer"
          >
            <ShieldCheck className="mt-0.5 w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-white">
                {enrollLabel}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Create the {enrollNoun} record and mark this lead converted.
              </span>
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
