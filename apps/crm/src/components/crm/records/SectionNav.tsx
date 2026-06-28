'use client';

import { Fragment, useCallback } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { SectionMeta } from './section-utils';
import { CRM_SECTION_NAV_EVENT, getSectionNavGroupLabel } from './section-utils';
import { getSectionNavAccent } from './section-accent-tokens';

export type { SectionMeta };

interface SectionNavProps {
  sections: SectionMeta[];
  activeSectionKey: string;
  onSectionClick: (key: string) => void;
}

export function SectionNav({ sections, activeSectionKey, onSectionClick }: SectionNavProps) {
  const handleClick = useCallback(
    (key: string) => {
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

  let lastGroup = sections[0]?.navGroup;

  return (
    <div className="sticky top-[140px] z-[5] -mx-1 border-b border-slate-200 bg-white/95 px-1 shadow-sm backdrop-blur-lg dark:border-white/5 dark:bg-slate-950/95">
      <div
        className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-thin"
        role="tablist"
        aria-label="Record sections"
      >
        {sections.map((s, index) => {
          const isActive = s.key === activeSectionKey;
          const navAccent = getSectionNavAccent(s.accent);
          const showGroupDivider = index > 0 && s.navGroup !== lastGroup;
          if (showGroupDivider) {
            lastGroup = s.navGroup;
          } else if (index === 0) {
            lastGroup = s.navGroup;
          }

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
                onClick={() => handleClick(s.key)}
                className={cn(
                  'inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  isActive ? navAccent.active : navAccent.inactive,
                )}
              >
                {s.label}
                <span
                  title={`${s.filledCount} of ${s.fieldCount} fields filled in`}
                  className={cn(
                    'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                    isActive ? navAccent.activeBadge : navAccent.inactiveBadge,
                  )}
                >
                  {s.filledCount}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
