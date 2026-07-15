'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SectionNav, type SectionMeta } from './SectionNav';
import {
  getPersistedActiveSection,
  persistActiveSection,
} from '@/lib/crm/record-section-persistence';

interface OverviewLayoutProps {
  recordId: string;
  sections: SectionMeta[];
  fieldContent: React.ReactNode;
  /**
   * Show the horizontal section-pill navigator. The V2 shell has its own
   * navigation chrome and a full-width coverage banner that should lead the
   * pane, so it hides these pills for the cleaner redesign layout.
   */
  showSectionNav?: boolean;
}

export function OverviewLayout({
  recordId,
  sections,
  fieldContent,
  showSectionNav = true,
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

  // Observe which section is currently in view and update the active pill
  useEffect(() => {
    if (sections.length <= 1) return;

    const sectionEls = sections
      .map((s) => document.getElementById(`section-${s.key}`))
      .filter(Boolean) as HTMLElement[];

    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
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
        rootMargin: '-180px 0px -60% 0px',
        threshold: 0.1,
      },
    );

    for (const el of sectionEls) observer.observe(el);
    return () => observer.disconnect();
  }, [sections, recordId]);

  return (
    <div ref={containerRef}>
      {/* Section pill navigator */}
      {showSectionNav && (
        <SectionNav
          sections={sections}
          activeSectionKey={activeSectionKey}
          onSectionClick={handleSectionClick}
        />
      )}

      {/* Full-width field sections */}
      <div className="mt-3">
        {fieldContent}
      </div>
    </div>
  );
}
