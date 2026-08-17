'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { SectionMeta } from './section-utils';
import { CRM_SECTION_NAV_EVENT, getSectionNavGroupLabel } from './section-utils';
import { getSectionCompactNavAccent, getSectionNavAccent } from './section-accent-tokens';
import { scrollRecordSectionAfterExpand } from '@/lib/crm/record-section-scroll';

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

  // The chip strip scrolls horizontally but hides its own scrollbar (with 27
  // sections it drew a permanent second scrollbar under the record header).
  // Overflow is measured and surfaced as chevron buttons + edge fades instead.
  const stripRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = {
        left: el.scrollLeft > 1,
        right: max > 1 && el.scrollLeft < max - 1,
      };
      setOverflow((prev) =>
        prev.left === next.left && prev.right === next.right ? prev : next,
      );
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [sections.length]);

  const scrollStrip = useCallback((direction: 'left' | 'right') => {
    const el = stripRef.current;
    if (!el) return;
    const delta = Math.max(200, Math.round(el.clientWidth * 0.6));
    el.scrollBy({ left: direction === 'left' ? -delta : delta, behavior: 'smooth' });
  }, []);

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

      // Expand (async React) then scroll the record <main>, not the viewport.
      scrollRecordSectionAfterExpand(key);
    },
    [onSectionClick],
  );

  if (sections.length <= 1) return null;

  return (
    <div
      className={cn(
        // Opaque sticky bar — alpha + backdrop-blur under the record header
        // ghosts field content through the chip/section strip (top-half flicker).
        'sticky z-[5] isolate -mx-1 border-b border-slate-200 bg-white px-1 dark:border-white/5 dark:bg-slate-950',
        compact ? 'shadow-none' : 'shadow-sm',
      )}
      style={{ top: 'var(--record-sticky-offset, 180px)' }}
    >
      <div className="relative">
      {overflow.left && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent dark:from-slate-950"
          />
          <button
            type="button"
            aria-label="Scroll sections left"
            onClick={() => scrollStrip('left')}
            className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-0.5 text-slate-500 shadow-sm hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        </>
      )}
      {overflow.right && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent dark:from-slate-950"
          />
          <button
            type="button"
            aria-label="Scroll sections right"
            onClick={() => scrollStrip('right')}
            className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-0.5 text-slate-500 shadow-sm hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </>
      )}
      <div
        ref={stripRef}
        className={cn(
          // Horizontal scroll + snap — never squash section pills into each other.
          // Own scrollbar hidden: overflow is surfaced via the chevrons/fades above.
          'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
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
    </div>
  );
}
