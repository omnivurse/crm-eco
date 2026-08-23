'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { SectionMeta } from './section-utils';
import {
  CRM_SECTION_NAV_EVENT,
  findSectionNavGroupForKey,
  groupSectionsForNav,
  type SectionNavGroup,
} from './section-utils';
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

/**
 * Section jump bar.
 *
 * Top row = one pill per nav GROUP (Profile · Coverage · Family · Address ·
 * Ownership · Admin …)
 * instead of one per section — a PIFH contact has 27 sections, which drew a
 * second scrollbar under the record header and buried the useful bands.
 * Clicking a group jumps to its first section. The per-section pills for the
 * ACTIVE group only render on a second row, so every section stays one click
 * away without the 27-pill wall. Records whose sections all share one group
 * (or single-group modules like deals) fall back to the flat per-section row.
 */
export function SectionNav({
  sections,
  activeSectionKey,
  onSectionClick,
  variant = 'pills',
}: SectionNavProps) {
  const compact = variant === 'compact';

  const bands = useMemo(() => groupSectionsForNav(sections), [sections]);
  const grouped = bands.length > 1;
  const activeGroup: SectionNavGroup | null = useMemo(
    () => findSectionNavGroupForKey(bands, activeSectionKey) ?? bands[0]?.group ?? null,
    [bands, activeSectionKey],
  );
  const activeBand = useMemo(
    () => bands.find((b) => b.group === activeGroup) ?? null,
    [bands, activeGroup],
  );
  const [subnavOpen, setSubnavOpen] = useState(false);
  useEffect(() => {
    setSubnavOpen(false);
  }, [activeGroup]);

  // The strip scrolls horizontally but hides its own scrollbar. Overflow is
  // measured and surfaced as chevron buttons + edge fades instead.
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
  }, [sections.length, activeGroup]);

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

  // Arrow-key roving focus inside a row of pills (WAI-ARIA tabs pattern).
  const handleRowKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    const row = e.currentTarget;
    const tabs = Array.from(row.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t === document.activeElement);
    let next = idx;
    if (e.key === 'ArrowLeft') next = idx <= 0 ? tabs.length - 1 : idx - 1;
    if (e.key === 'ArrowRight') next = idx >= tabs.length - 1 ? 0 : idx + 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    e.preventDefault();
    tabs[next]?.focus();
  }, []);

  if (sections.length <= 1) return null;

  const renderSectionPill = (s: SectionMeta) => {
    const isActive = s.key === activeSectionKey;
    const navAccent = getSectionNavAccent(s.accent);
    const compactAccent = getSectionCompactNavAccent(s.accent);
    // Notes pills show the real note-record count (mirrors the sidebar);
    // every other pill shows how many of its fields are filled in.
    const badgeValue = s.badgeCount ?? s.filledCount;
    const badgeTitle =
      s.badgeCount !== undefined
        ? `${s.badgeCount} note${s.badgeCount === 1 ? '' : 's'}`
        : `${s.filledCount} of ${s.fieldCount} fields filled in`;
    return (
      <button
        key={s.key}
        type="button"
        role="tab"
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        onClick={() => handleClick(s)}
        className={cn(
          'inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
    );
  };

  return (
    <div
      className={cn(
        // Opaque sticky bar — alpha + backdrop-blur under the record header
        // ghosts field content through the chip/section strip (top-half flicker).
        // z-15 sits above scrolling fields and below the record header (z-20).
        'sticky z-[15] isolate -mx-1 border-b border-slate-200 bg-white px-1 dark:border-white/5 dark:bg-slate-950',
        compact ? 'shadow-none' : 'shadow-sm',
      )}
      style={{ top: 'var(--record-sticky-offset, 180px)' }}
    >
      {/* Row 1 — group pills (or the flat per-section row when there is one group) */}
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
          // Horizontal scroll + snap — never squash pills into each other.
          // Own scrollbar hidden: overflow is surfaced via the chevrons/fades above.
          'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          compact ? 'items-stretch gap-1 py-1' : 'items-center gap-2 py-2.5',
        )}
        // RP-6: target of the record header's "Skip to record details" link.
        // tabIndex -1 keeps it out of the sequential order but lets the skip
        // link land focus here (the roving tab pills stay the Tab stops).
        id="record-section-nav"
        tabIndex={-1}
        role="tablist"
        aria-label={grouped ? 'Record section groups' : 'Record sections'}
        onKeyDown={handleRowKeyDown}
      >
        {grouped
          ? bands.map((band) => {
              const isActive = band.group === activeGroup;
              const first = band.sections[0];
              const navAccent = getSectionNavAccent(first?.accent);
              const compactAccent = getSectionCompactNavAccent(first?.accent);
              const badgeValue = band.badgeCount ?? band.filledCount;
              const badgeTitle =
                band.badgeCount !== undefined
                  ? `${band.badgeCount} note${band.badgeCount === 1 ? '' : 's'}`
                  : `${band.filledCount} of ${band.fieldCount} fields filled in · ${band.sections.length} section${band.sections.length === 1 ? '' : 's'}`;
              return (
                <button
                  key={band.group}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={isActive ? 'record-section-nav-sections' : undefined}
                  tabIndex={isActive ? 0 : -1}
                  title={badgeTitle}
                  onClick={() => {
                    if (first) handleClick(first);
                  }}
                  className={cn(
                    'inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    compact
                      ? cn(
                          'border-b-2 px-2.5 py-1 text-xs font-semibold',
                          isActive ? compactAccent.active : compactAccent.inactive,
                        )
                      : cn(
                          'rounded-full px-3.5 py-1.5 text-xs font-semibold',
                          isActive ? navAccent.active : navAccent.inactive,
                        ),
                  )}
                >
                  {band.label}
                  <span
                    className={cn(
                      'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                      isActive ? navAccent.activeBadge : navAccent.inactiveBadge,
                    )}
                  >
                    {badgeValue}
                  </span>
                </button>
              );
            })
          : sections.map(renderSectionPill)}
      </div>
      </div>

      {/* Row 2 — per-section pills for the active group only. Hidden when the
          group has a single section (its pill would duplicate the group pill).
          RP-6: xl+ only — below that the group row alone must leave the
          one-glance snapshot above the fold (group pills still jump). */}
      {grouped && activeBand && activeBand.sections.length > 1 && (
        <div className="max-xl:hidden border-t border-slate-100 dark:border-white/5">
          {activeBand.sections.length > 4 && !subnavOpen ? (
            <button
              type="button"
              onClick={() => setSubnavOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              {activeBand.sections.length} sections in {activeBand.label}
            </button>
          ) : (
            <div
              id="record-section-nav-sections"
              role="tablist"
              aria-label={`${activeBand.label} sections`}
              onKeyDown={handleRowKeyDown}
              className={cn('flex flex-wrap items-center gap-1', compact ? 'py-1' : 'py-1.5')}
            >
              {activeBand.sections.map(renderSectionPill)}
              {activeBand.sections.length > 4 && (
                <button
                  type="button"
                  onClick={() => setSubnavOpen(false)}
                  className="inline-flex items-center gap-0.5 px-1.5 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label="Hide section pills"
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  Hide
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
