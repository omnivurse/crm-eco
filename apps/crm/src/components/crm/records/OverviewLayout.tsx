'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SectionNav, type SectionMeta } from './SectionNav';
import {
  getPersistedActiveSection,
  persistActiveSection,
} from '@/lib/crm/record-section-persistence';
import {
  getRecordScrollRoot,
  isSectionJumpSuppressed,
} from '@/lib/crm/record-section-scroll';

interface OverviewLayoutProps {
  recordId: string;
  sections: SectionMeta[];
  fieldContent: React.ReactNode;
  /**
   * Show the section navigator. Both classic (pills) and the V2 power cockpit
   * (compact underline jump bar) render it; only single-section records hide it.
   */
  showSectionNav?: boolean;
  /** Nav style — 'compact' for the V2 cockpit jump bar, 'pills' for classic. */
  navVariant?: 'pills' | 'compact';
}

export function OverviewLayout({
  recordId,
  sections,
  fieldContent,
  showSectionNav = true,
  navVariant = 'pills',
}: OverviewLayoutProps) {
  const [activeSectionKey, setActiveSectionKey] = useState(() => {
    const persisted = getPersistedActiveSection(recordId);
    if (persisted && sections.some((s) => s.key === persisted)) return persisted;
    return sections[0]?.key ?? '';
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSectionClick = useCallback(
    (key: string) => {
      setActiveSectionKey(key);
      persistActiveSection(recordId, key);
    },
    [recordId],
  );

  useEffect(() => {
    if (!activeSectionKey) return;
    persistActiveSection(recordId, activeSectionKey);
  }, [recordId, activeSectionKey]);

  // Observe which section is currently in view and update the active pill.
  // Root must be the record <main> scroller (not the viewport), otherwise the
  // top sticky chrome section always "wins" and snaps the pill after a jump.
  useEffect(() => {
    if (sections.length <= 1) return;

    const sectionEls = sections
      .map((s) => document.getElementById(`section-${s.key}`))
      .filter(Boolean) as HTMLElement[];

    if (sectionEls.length === 0) return;

    const scrollRoot = getRecordScrollRoot();
    const stickyPx = scrollRoot
      ? Math.round(
          Number.parseFloat(
            getComputedStyle(scrollRoot)
              .getPropertyValue('--record-sticky-offset')
              .trim(),
          ) || 180,
        )
      : 180;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isSectionJumpSuppressed()) return;

        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) {
          const key = topEntry.target.getAttribute('data-section');
          if (key) {
            setActiveSectionKey(key);
            persistActiveSection(recordId, key);
          }
        }
      },
      {
        root: scrollRoot,
        // Top band = sticky header + nav; bottom band keeps "active" near top.
        rootMargin: `-${stickyPx}px 0px -55% 0px`,
        threshold: 0.1,
      },
    );

    for (const el of sectionEls) observer.observe(el);
    return () => observer.disconnect();
  }, [sections, recordId]);

  return (
    <div ref={containerRef}>
      {/* Section navigator — field-band jump bar */}
      {showSectionNav && (
        <SectionNav
          sections={sections}
          activeSectionKey={activeSectionKey}
          onSectionClick={handleSectionClick}
          variant={navVariant}
        />
      )}

      {/* Full-width field sections */}
      <div className={navVariant === 'compact' ? 'mt-2' : 'mt-3'}>
        {fieldContent}
      </div>
    </div>
  );
}
