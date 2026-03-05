'use client';

import type { CustomHtmlSectionData } from '@/lib/landing-pages/types';

export function CustomHtmlPreview({ data }: { data: CustomHtmlSectionData }) {
  return (
    <div className="bg-white dark:bg-slate-900">
      <div dangerouslySetInnerHTML={{ __html: data.html || '<div style="padding:2rem;text-align:center;color:#94a3b8;">Custom HTML content</div>' }} />
    </div>
  );
}
