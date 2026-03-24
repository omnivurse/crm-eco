'use client';

import { useRef, useCallback } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { SectionMeta } from './section-utils';

export type { SectionMeta };

interface SectionNavProps {
  sections: SectionMeta[];
  activeSectionKey: string;
  onSectionClick: (key: string) => void;
}

export function SectionNav({ sections, activeSectionKey, onSectionClick }: SectionNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (key: string) => {
      onSectionClick(key);

      // Smooth-scroll the target section into view
      const el = document.getElementById(`section-${key}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [onSectionClick],
  );

  if (sections.length <= 1) return null;

  return (
    <div className="sticky top-[140px] z-[5] bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-b border-slate-200 dark:border-white/5 -mx-1 px-1 shadow-sm">
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-hide"
      >
        {sections.map((s) => {
          const isActive = s.key === activeSectionKey;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => handleClick(s.key)}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/30'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              {s.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold',
                  isActive
                    ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
                )}
              >
                {s.fieldCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
