'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import type { LandingPageSection } from '@/lib/landing-pages/types';
import { HeroPreview } from './previews/HeroPreview';
import { ContentPreview } from './previews/ContentPreview';
import { FeaturesPreview } from './previews/FeaturesPreview';
import { FormPreview } from './previews/FormPreview';
import { PricingPreview } from './previews/PricingPreview';
import { TestimonialsPreview } from './previews/TestimonialsPreview';
import { CtaPreview } from './previews/CtaPreview';
import { FaqPreview } from './previews/FaqPreview';
import { CustomHtmlPreview } from './previews/CustomHtmlPreview';
import { MousePointerClick } from 'lucide-react';

function SectionPreviewRouter({ section }: { section: LandingPageSection }) {
  const data = section.data as any;
  switch (section.type) {
    case 'hero': return <HeroPreview data={data} />;
    case 'content': return <ContentPreview data={data} />;
    case 'features': return <FeaturesPreview data={data} />;
    case 'form': return <FormPreview data={data} />;
    case 'pricing': return <PricingPreview data={data} />;
    case 'testimonials': return <TestimonialsPreview data={data} />;
    case 'cta': return <CtaPreview data={data} />;
    case 'faq': return <FaqPreview data={data} />;
    case 'custom_html': return <CustomHtmlPreview data={data} />;
    default: return <div className="p-4 text-slate-400">Unknown section type</div>;
  }
}

interface BuilderCanvasProps {
  sections: LandingPageSection[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
}

export function BuilderCanvas({ sections, selectedSectionId, onSelectSection }: BuilderCanvasProps) {
  const { setNodeRef } = useDroppable({ id: 'canvas' });

  if (sections.length === 0) {
    return (
      <div ref={setNodeRef} className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-950/50">
        <div className="text-center">
          <MousePointerClick className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">
            Start building your page
          </h3>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Click a section type from the sidebar to add it
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950/50 p-6">
      <div className="max-w-4xl mx-auto space-y-2">
        {sections.map((section) => {
          if (!section.visible) return null;
          return (
            <div
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              className={cn(
                'relative rounded-xl overflow-hidden cursor-pointer transition-all border-2',
                selectedSectionId === section.id
                  ? 'border-teal-500 shadow-lg shadow-teal-500/10'
                  : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              {/* Section type label */}
              {selectedSectionId === section.id && (
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-teal-500 text-white text-[10px] font-bold uppercase tracking-wider rounded">
                  {section.title}
                </div>
              )}
              <SectionPreviewRouter section={section} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
