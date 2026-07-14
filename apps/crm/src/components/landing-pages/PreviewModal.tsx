'use client';

import { useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Monitor, Tablet, Smartphone, X } from 'lucide-react';
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

type Device = 'desktop' | 'tablet' | 'mobile';

function SectionRenderer({ section }: { section: LandingPageSection }) {
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
    default: return null;
  }
}

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: LandingPageSection[];
  pageName: string;
}

export function PreviewModal({ open, onOpenChange, sections, pageName }: PreviewModalProps) {
  const [device, setDevice] = useState<Device>('desktop');

  const deviceWidths: Record<Device, string> = {
    desktop: 'max-w-full',
    tablet: 'max-w-[768px]',
    mobile: 'max-w-[375px]',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="max-w-[95vw] w-full h-[90vh] p-0 flex flex-col gap-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
          <DialogTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">{pageName} — Preview</DialogTitle>
          <div className="flex items-center gap-1">
            <Button
              variant={device === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDevice('desktop')}
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              variant={device === 'tablet' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDevice('tablet')}
            >
              <Tablet className="w-4 h-4" />
            </Button>
            <Button
              variant={device === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDevice('mobile')}
            >
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-y-auto bg-slate-200 dark:bg-slate-950 flex justify-center">
          <div className={cn('w-full bg-white dark:bg-slate-900 shadow-xl transition-all', deviceWidths[device])}>
            {sections.filter((s) => s.visible).map((section) => (
              <SectionRenderer key={section.id} section={section} />
            ))}
            {sections.filter((s) => s.visible).length === 0 && (
              <div className="flex items-center justify-center h-64 text-slate-400">
                No visible sections
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
