'use client';

import { useState, useEffect, useRef } from 'react';
import { SectionNav, type SectionMeta } from './SectionNav';

interface OverviewLayoutProps {
  sections: SectionMeta[];
  fieldContent: React.ReactNode;
  notesContent: React.ReactNode;
}

export function OverviewLayout({ sections, fieldContent, notesContent }: OverviewLayoutProps) {
  const [activeSectionKey, setActiveSectionKey] = useState(sections[0]?.key ?? '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Observe which section is currently in view and update the active pill
  useEffect(() => {
    if (sections.length <= 1) return;

    const sectionEls = sections
      .map((s) => document.getElementById(`section-${s.key}`))
      .filter(Boolean) as HTMLElement[];

    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
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
          if (key) setActiveSectionKey(key);
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0.1,
      },
    );

    for (const el of sectionEls) observer.observe(el);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div ref={containerRef}>
      {/* Section pill navigator */}
      <SectionNav
        sections={sections}
        activeSectionKey={activeSectionKey}
        onSectionClick={setActiveSectionKey}
      />

      {/* 2-column layout: fields left, notes right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
        {/* Left column — field sections (wider) */}
        <div className="lg:col-span-2 min-w-0">
          {fieldContent}
        </div>

        {/* Right column — notes & metadata (sticky sidebar) */}
        <div className="lg:col-span-1 min-w-0">
          <div className="lg:sticky lg:top-16 space-y-5">
            {notesContent}
          </div>
        </div>
      </div>
    </div>
  );
}
