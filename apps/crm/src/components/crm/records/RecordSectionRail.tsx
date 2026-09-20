'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, PanelLeftClose, Search } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  RECORD_SECTION_RAIL_DEFAULT_OPEN,
  computeRecordSectionRailMaxHeight,
  readRecordSectionRailOpen,
  scrollChildIntoNearest,
  subscribeRecordSectionRailOpen,
  writeRecordSectionRailOpen,
} from '@/lib/crm/record-section-rail';
import { getRecordScrollRoot, scrollRecordSectionAfterExpand } from '@/lib/crm/record-section-scroll';
import type { SectionMeta } from './section-utils';
import {
  CRM_SECTION_NAV_EVENT,
  groupSectionsForNav,
  pickSectionNavJumpTarget,
  type SectionNavGroupBand,
} from './section-utils';
import { getSectionNavAccent } from './section-accent-tokens';

export type { SectionMeta };

interface RecordSectionRailProps {
  sections: SectionMeta[];
  activeSectionKey: string;
  onSectionClick: (key: string) => void;
}

/**
 * Left record-section rail.
 *
 * Every group AND every subsection is listed at once — clicking Notes does
 * not swap in a second row of surprise links. Default open. Collapses to a
 * vertical "Sections" tab the same way Insights does on the right.
 */
export function RecordSectionRail({
  sections,
  activeSectionKey,
  onSectionClick,
}: RecordSectionRailProps) {
  const bands = useMemo(() => groupSectionsForNav(sections), [sections]);
  const grouped = bands.length > 1;
  const open = useSyncExternalStore(
    subscribeRecordSectionRailOpen,
    readRecordSectionRailOpen,
    () => RECORD_SECTION_RAIL_DEFAULT_OPEN,
  );

  const navigateToSection = useCallback(
    (section: SectionMeta, expandKeys?: string[]) => {
      if (section.navAction === 'open-notes') {
        window.dispatchEvent(new CustomEvent('crm:switch-tab', { detail: 'notes' }));
        return;
      }

      const keys = expandKeys?.length ? expandKeys : [section.key];
      onSectionClick(section.key);

      window.dispatchEvent(
        new CustomEvent(CRM_SECTION_NAV_EVENT, {
          bubbles: true,
          detail: { key: section.key, keys },
        }),
      );

      scrollRecordSectionAfterExpand(keys);
    },
    [onSectionClick],
  );

  const handleSectionClick = useCallback(
    (section: SectionMeta) => {
      navigateToSection(section);
    },
    [navigateToSection],
  );

  const handleGroupClick = useCallback(
    (band: SectionNavGroupBand) => {
      const target = pickSectionNavJumpTarget(band.sections);
      if (!target) return;
      navigateToSection(target, [
        target.key,
        ...band.sections.map((s) => s.key).filter((k) => k !== target.key),
      ]);
    },
    [navigateToSection],
  );

  const asideRef = useRef<HTMLElement>(null);
  const [railMaxHeight, setRailMaxHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = asideRef.current;
    if (!el) return;

    const measure = () => {
      const next = computeRecordSectionRailMaxHeight({
        railTop: el.getBoundingClientRect().top,
        viewportHeight: window.innerHeight,
      });
      setRailMaxHeight((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    const scrollRoot = getRecordScrollRoot();
    scrollRoot?.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      scrollRoot?.removeEventListener('scroll', measure);
    };
  }, [open, sections.length]);

  useLayoutEffect(() => {
    if (!open) return;
    const box = asideRef.current;
    if (!box) return;
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(activeSectionKey)
        : activeSectionKey.replace(/"/g, '\\"');
    const active =
      box.querySelector<HTMLElement>(`[data-rail-section="${escaped}"]`) ??
      box.querySelector<HTMLElement>('[aria-current="true"]');
    if (active) scrollChildIntoNearest(box, active);
  }, [activeSectionKey, open, railMaxHeight]);

  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    const root = e.currentTarget;
    const items = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-rail-item]'));
    if (items.length === 0) return;
    const idx = items.findIndex((t) => t === document.activeElement);
    let next = idx;
    if (e.key === 'ArrowUp') next = idx <= 0 ? items.length - 1 : idx - 1;
    if (e.key === 'ArrowDown') next = idx >= items.length - 1 ? 0 : idx + 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = items.length - 1;
    e.preventDefault();
    items[next]?.focus();
  }, []);

  if (sections.length <= 1) return null;

  const stickyTop = { top: 'var(--record-sticky-offset, 11rem)' } as const;

  if (!open) {
    return (
      <div
        id="record-section-nav"
        tabIndex={-1}
        className="shrink-0"
        data-testid="crm-record-section-rail"
      >
        <button
          type="button"
          onClick={() => writeRecordSectionRailOpen(true)}
          className="mb-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-teal-600 dark:border-white/10 dark:bg-slate-900 md:hidden"
          aria-label="Expand sections panel"
          title="Show sections"
        >
          Sections
        </button>
        <button
          type="button"
          onClick={() => writeRecordSectionRailOpen(true)}
          className="hidden md:flex sticky self-start items-center gap-1 px-1 py-3 rounded-r-lg border border-l-0 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:text-teal-600 transition-colors"
          style={stickyTop}
          aria-label="Expand sections panel"
          title="Show sections"
        >
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-wider font-semibold">
            Sections
          </span>
          <ChevronDown className="w-4 h-4 -rotate-90" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex min-w-0 shrink-0 flex-col gap-1 sticky self-start"
      style={{
        ...stickyTop,
        width: '13rem',
        maxWidth: '13rem',
      }}
      data-testid="crm-record-section-rail"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Sections
        </span>
        <button
          type="button"
          onClick={() => writeRecordSectionRailOpen(false)}
          aria-label="Collapse sections panel"
          title="Hide sections"
          className="inline-flex items-center justify-center rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-teal-600 dark:text-slate-400 dark:hover:bg-white/5"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <aside
        ref={asideRef}
        aria-label="Record sections"
        className="flex min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white scrollbar-thin dark:border-white/10 dark:bg-slate-900"
        style={{
          maxHeight:
            railMaxHeight != null
              ? `${railMaxHeight}px`
              : 'calc(100dvh - var(--record-sticky-offset, 11rem) - 5rem)',
        }}
      >
        <button
          type="button"
          aria-label="Find a field in this record"
          title="Find a field or value in this record (press /)"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('crm:focus-record-search'));
          }}
          className="sticky top-0 z-10 mx-1.5 mt-1.5 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          Find field
        </button>

        <nav
          id="record-section-nav"
          tabIndex={-1}
          aria-label="Record sections"
          onKeyDown={handleTreeKeyDown}
          className="min-h-0 px-1.5 pb-2 pt-1"
        >
          {grouped
            ? bands.map((band) => {
                const childActive = band.sections.some((s) => s.key === activeSectionKey);
                const showChildren = band.sections.length > 1;
                const first = band.sections[0];
                const accent = getSectionNavAccent(first?.accent);
                const badgeValue = band.badgeCount ?? band.filledCount;
                const badgeTitle =
                  band.badgeCount !== undefined
                    ? `${band.badgeCount} note${band.badgeCount === 1 ? '' : 's'}`
                    : `${band.filledCount} of ${band.fieldCount} fields filled in · ${band.sections.length} section${band.sections.length === 1 ? '' : 's'}`;

                return (
                  <div key={band.group} className="mb-1.5 last:mb-0">
                    <button
                      type="button"
                      data-rail-item
                      data-rail-group={band.group}
                      title={badgeTitle}
                      aria-current={childActive && !showChildren ? 'true' : undefined}
                      onClick={() =>
                        showChildren ? handleGroupClick(band) : handleSectionClick(band.sections[0])
                      }
                      className={cn(
                        'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        childActive
                          ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <span className="min-w-0 truncate">{band.label}</span>
                      <span
                        title={badgeTitle}
                        className={cn(
                          'ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                          childActive ? accent.activeBadge : accent.inactiveBadge,
                        )}
                      >
                        {badgeValue}
                      </span>
                    </button>
                    {showChildren && (
                      <div className="mt-px space-y-px border-l border-slate-100 pl-0.5 dark:border-white/5">
                        {band.sections.map((section) => (
                          <RailSectionButton
                            key={section.key}
                            section={section}
                            isActive={section.key === activeSectionKey}
                            indent
                            onClick={() => handleSectionClick(section)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            : sections.map((section) => (
                <RailSectionButton
                  key={section.key}
                  section={section}
                  isActive={section.key === activeSectionKey}
                  onClick={() => handleSectionClick(section)}
                />
              ))}
        </nav>
      </aside>
    </div>
  );
}

function RailSectionButton({
  section,
  isActive,
  indent,
  onClick,
}: {
  section: SectionMeta;
  isActive: boolean;
  indent?: boolean;
  onClick: () => void;
}) {
  const accent = getSectionNavAccent(section.accent);
  const badgeValue = section.badgeCount ?? section.filledCount;
  const badgeTitle =
    section.badgeCount !== undefined
      ? `${section.badgeCount} note${section.badgeCount === 1 ? '' : 's'}`
      : `${section.filledCount} of ${section.fieldCount} fields filled in`;

  return (
    <button
      type="button"
      data-rail-item
      data-rail-section={section.key}
      aria-current={isActive ? 'true' : undefined}
      title={badgeTitle}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        indent && 'pl-3',
        isActive
          ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-white/10 dark:text-white'
          : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white',
      )}
    >
      <span className="min-w-0 truncate">{section.label}</span>
      <span
        title={badgeTitle}
        className={cn(
          'ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
          isActive ? accent.activeBadge : accent.inactiveBadge,
        )}
      >
        {badgeValue}
      </span>
    </button>
  );
}
