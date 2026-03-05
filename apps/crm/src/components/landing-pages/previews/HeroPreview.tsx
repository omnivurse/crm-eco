'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import type { HeroSectionData } from '@/lib/landing-pages/types';

export function HeroPreview({ data }: { data: HeroSectionData }) {
  const bgStyle: React.CSSProperties = data.backgroundImageUrl
    ? { backgroundImage: `url(${data.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: data.backgroundColor || '#0d9488' };

  return (
    <div className="relative" style={bgStyle}>
      {data.backgroundImageUrl && (
        <div className="absolute inset-0 bg-black/40" />
      )}
      <div
        className={cn(
          'relative px-8 py-16 text-white',
          data.layout === 'centered' && 'text-center',
          data.layout === 'left-aligned' && 'text-left max-w-2xl',
          data.layout === 'split' && 'text-left max-w-lg',
        )}
      >
        <h1 className="text-3xl font-bold mb-3 leading-tight">{data.headline || 'Your Headline'}</h1>
        <p className="text-lg opacity-90 mb-6">{data.subheadline || 'Your subheadline goes here'}</p>
        {data.ctaText && (
          <button className="px-6 py-2.5 bg-white text-slate-900 font-semibold rounded-lg text-sm hover:bg-slate-100 transition-colors">
            {data.ctaText}
          </button>
        )}
      </div>
    </div>
  );
}
