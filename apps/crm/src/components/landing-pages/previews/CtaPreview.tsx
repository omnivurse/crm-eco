'use client';

import type { CtaSectionData } from '@/lib/landing-pages/types';

export function CtaPreview({ data }: { data: CtaSectionData }) {
  return (
    <div className="px-8 py-14 text-center text-white" style={{ backgroundColor: data.backgroundColor || '#0d9488' }}>
      <h2 className="text-2xl font-bold mb-2">{data.headline || 'Call to Action'}</h2>
      <p className="text-sm opacity-90 mb-6 max-w-lg mx-auto">{data.description}</p>
      <div className="flex items-center justify-center gap-3">
        {data.primaryButtonText && (
          <button className="px-6 py-2.5 bg-white text-slate-900 font-semibold rounded-lg text-sm hover:bg-slate-100 transition-colors">
            {data.primaryButtonText}
          </button>
        )}
        {data.secondaryButtonText && (
          <button className="px-6 py-2.5 border border-white/30 text-white font-semibold rounded-lg text-sm hover:bg-white/10 transition-colors">
            {data.secondaryButtonText}
          </button>
        )}
      </div>
    </div>
  );
}
