'use client';

import { useState, useEffect, useRef } from 'react';
import { SectionNav, type SectionMeta } from './SectionNav';

interface OverviewLayoutProps {
  sections: SectionMeta[];
  fieldContent: React.ReactNode;
}

export function OverviewLayout({ sections, fieldContent }: OverviewLayoutProps) {
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

      {/* Full-width field sections */}
      <div className="mt-5">
        {fieldContent}
      </div>
    </div>
  );
}
