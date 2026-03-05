'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { X, Settings2 } from 'lucide-react';
import type { LandingPageSection, SectionType } from '@/lib/landing-pages/types';
import { HeroEditor } from './editors/HeroEditor';
import { ContentEditor } from './editors/ContentEditor';
import { FormEditor } from './editors/FormEditor';
import { CtaEditor } from './editors/CtaEditor';
import { FeaturesEditor } from './editors/FeaturesEditor';
import { FaqEditor } from './editors/FaqEditor';
import { TestimonialsEditor } from './editors/TestimonialsEditor';
import { PricingEditor } from './editors/PricingEditor';
import { CustomHtmlEditor } from './editors/CustomHtmlEditor';

interface BuilderPropertiesProps {
  section: LandingPageSection | null;
  onUpdateSection: (id: string, updates: Partial<LandingPageSection>) => void;
  onClose: () => void;
}

export function BuilderProperties({ section, onUpdateSection, onClose }: BuilderPropertiesProps) {
  if (!section) {
    return (
      <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center px-6">
          <Settings2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Select a section to edit its properties
          </p>
        </div>
      </div>
    );
  }

  const handleDataChange = (data: any) => {
    onUpdateSection(section.id, { data });
  };

  const handleTitleChange = (title: string) => {
    onUpdateSection(section.id, { title });
  };

  return (
    <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Properties
          </p>
          <Input
            value={section.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-7 text-sm font-medium"
            placeholder="Section title"
          />
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <SectionEditor
          type={section.type}
          data={section.data}
          onChange={handleDataChange}
        />
      </div>
    </div>
  );
}

function SectionEditor({
  type,
  data,
  onChange,
}: {
  type: SectionType;
  data: any;
  onChange: (data: any) => void;
}) {
  switch (type) {
    case 'hero': return <HeroEditor data={data} onChange={onChange} />;
    case 'content': return <ContentEditor data={data} onChange={onChange} />;
    case 'form': return <FormEditor data={data} onChange={onChange} />;
    case 'cta': return <CtaEditor data={data} onChange={onChange} />;
    case 'features': return <FeaturesEditor data={data} onChange={onChange} />;
    case 'faq': return <FaqEditor data={data} onChange={onChange} />;
    case 'testimonials': return <TestimonialsEditor data={data} onChange={onChange} />;
    case 'pricing': return <PricingEditor data={data} onChange={onChange} />;
    case 'custom_html': return <CustomHtmlEditor data={data} onChange={onChange} />;
    default: return <p className="text-sm text-slate-400">No editor available for this section type.</p>;
  }
}
