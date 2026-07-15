'use client';

import { Fragment, useCallback } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { SectionMeta } from './section-utils';
import { CRM_SECTION_NAV_EVENT, getSectionNavGroupLabel } from './section-utils';
import { getSectionCompactNavAccent, getSectionNavAccent } from './section-accent-tokens';

export type { SectionMeta };

interface SectionNavProps {
  sections: SectionMeta[];
  activeSectionKey: string;
  onSectionClick: (key: string) => void;
  /**
   * 'pills' (classic) renders large rounded pills. 'compact' (Layout V2 power
   * cockpit) renders slim underline-tab jump links so the bar reads as a dense
   * field-band navigator that pins directly beneath the header strip.
   */
  variant?: 'pills' | 'compact';
}

export function SectionNav({
  sections,
  activeSectionKey,
  onSectionClick,
  variant = 'pills',
}: SectionNavProps) {
  const compact = variant === 'compact';
  const handleClick = useCallback(
    (section: SectionMeta) => {
      // Notes-group pills open the Notes related list (the source of truth for
      // note records) rather than scrolling to the legacy notes_history field
      // section, so the pill and the sidebar count point at the same place.
      if (section.navAction === 'open-notes') {
        window.dispatchEvent(new CustomEvent('crm:switch-tab', { detail: 'notes' }));
        return;
      }

      const key = section.key;
      onSectionClick(key);

      window.dispatchEvent(
        new CustomEvent(CRM_SECTION_NAV_EVENT, {
          bubbles: true,
          detail: { key },
        }),
      );

      const scrollToTarget = () => {
        const el = document.getElementById(`section-${key}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };

      window.setTimeout(() => {
        requestAnimationFrame(scrollToTarget);
      }, 100);
    },
    [onSectionClick],
  );

  if (sections.length <= 1) return null;

  return (
    <div
      className={cn(
        'sticky z-[5] -mx-1 border-b border-slate-200 bg-white/95 px-1 backdrop-blur-lg dark:border-white/5 dark:bg-slate-950/95',
        compact ? 'shadow-none' : 'shadow-sm',
      )}
      style={{ top: 'var(--record-sticky-offset, 180px)' }}
    >
      <div
        className={cn(
          'flex overflow-x-auto scrollbar-thin',
          compact ? 'items-stretch gap-1 py-1' : 'items-center gap-2 py-2.5',
        )}
        role="tablist"
        aria-label="Record sections"
      >
        {sections.map((s, index) => {
          const isActive = s.key === activeSectionKey;
          const navAccent = getSectionNavAccent(s.accent);
          const compactAccent = getSectionCompactNavAccent(s.accent);
          // A group divider starts wherever this section's band differs from the
          // previous section's — computed from the array (no render-time mutation).
          const showGroupDivider =
            index > 0 && s.navGroup !== sections[index - 1]?.navGroup;

          // Notes pills show the real note-record count (mirrors the sidebar);
          // every other pill shows how many of its fields are filled in.
          const badgeValue = s.badgeCount ?? s.filledCount;
          const badgeTitle =
            s.badgeCount !== undefined
              ? `${s.badgeCount} note${s.badgeCount === 1 ? '' : 's'}`
              : `${s.filledCount} of ${s.fieldCount} fields filled in`;

          return (
            <Fragment key={s.key}>
              {showGroupDivider && (
                <div
                  className="flex shrink-0 items-center gap-2 pl-1"
                  aria-hidden
                >
                  <span className="h-4 w-px bg-slate-200 dark:bg-white/10" />
                  <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:inline">
                    {getSectionNavGroupLabel(s.navGroup)}
                  </span>
                </div>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleClick(s)}
                className={cn(
                  'inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap transition-colors',
                  compact
                    ? cn(
                        'border-b-2 px-2 py-1 text-xs font-medium',
                        isActive ? compactAccent.active : compactAccent.inactive,
                      )
                    : cn(
                        'rounded-full px-3.5 py-1.5 text-xs font-medium',
                        isActive ? navAccent.active : navAccent.inactive,
                      ),
                )}
              >
                {s.label}
                <span
                  title={badgeTitle}
                  className={cn(
                    'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                    isActive ? navAccent.activeBadge : navAccent.inactiveBadge,
                  )}
                >
                  {badgeValue}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
