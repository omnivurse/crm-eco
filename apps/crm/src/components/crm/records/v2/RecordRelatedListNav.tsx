'use client';

import { type ComponentType, memo } from 'react';
import {
  StickyNote,
  Mail,
  CheckSquare,
  CheckCircle2,
  Paperclip,
  Link2,
  GitBranch,
  ShoppingBag,
  Megaphone,
  Globe,
  Share2,
  ClipboardList,
  LifeBuoy,
  CalendarCheck,
  Plus,
  Link as LinkIcon,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

export interface RelatedListNavItem {
  id: string;
  label: string;
  count?: number | null;
  /** Set to true for modules we ship in PR 2. `false` shows a coming-soon pill. */
  available: boolean;
  /** Optional tooltip for the coming-soon state. */
  comingSoonHint?: string;
}

export interface RecordRelatedListLink {
  id: string;
  label: string;
  href: string;
  external?: boolean;
}

export interface RecordRelatedListNavProps {
  items: RelatedListNavItem[];
  links?: RecordRelatedListLink[];
  activeId: string;
  onSelect: (id: string) => void;
  onAddRelatedList?: () => void;
  onAddLink?: () => void;
  className?: string;
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  overview: FileText,
  notes: StickyNote,
  emails: Mail,
  communications: Mail,
  activities: CheckSquare,
  open_activities: CheckSquare,
  closed_activities: CheckCircle2,
  attachments: Paperclip,
  files: Paperclip,
  related: Link2,
  connected: Link2,
  cadences: GitBranch,
  products: ShoppingBag,
  campaigns: Megaphone,
  visits: Globe,
  social: Share2,
  surveys: ClipboardList,
  desk: LifeBuoy,
  meetings: CalendarCheck,
  invited_meetings: CalendarCheck,
};

export const RecordRelatedListNav = memo(function RecordRelatedListNav({
  items,
  links = [],
  activeId,
  onSelect,
  onAddRelatedList,
  onAddLink,
  className,
}: RecordRelatedListNavProps) {
  return (
    <nav
      aria-label="Related list navigation"
      className={cn(
        'w-56 shrink-0 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300',
        className,
      )}
    >
      <header className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Related List
      </header>

      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = ICONS[item.id] || Link2;
          const isActive = activeId === item.id;
          const disabled = !item.available;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => item.available && onSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={disabled}
                title={disabled ? item.comingSoonHint || 'Coming soon' : undefined}
                className={cn(
                  'group w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors',
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-l-2 border-teal-500'
                    : disabled
                      ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed border-l-2 border-transparent'
                      : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 border-l-2 border-transparent',
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400')} />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 ? (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold',
                      isActive
                        ? 'bg-teal-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                    )}
                  >
                    {item.count}
                  </span>
                ) : disabled ? (
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Soon
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}

        {onAddRelatedList && (
          <li>
            <button
              type="button"
              onClick={onAddRelatedList}
              className="group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 border-l-2 border-transparent"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Related List
            </button>
          </li>
        )}
      </ul>

      {(links.length > 0 || onAddLink) && (
        <>
          <header className="mt-5 px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Links
          </header>
          <ul className="space-y-0.5">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 border-l-2 border-transparent"
                >
                  {link.external ? (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{link.label}</span>
                </a>
              </li>
            ))}
            {onAddLink && (
              <li>
                <button
                  type="button"
                  onClick={onAddLink}
                  className="group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 border-l-2 border-transparent"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Link
                </button>
              </li>
            )}
          </ul>
        </>
      )}
    </nav>
  );
});
