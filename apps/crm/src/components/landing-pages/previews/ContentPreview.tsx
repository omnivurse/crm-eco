'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import type { ContentSectionData } from '@/lib/landing-pages/types';

export function ContentPreview({ data }: { data: ContentSectionData }) {
  const hasImage = data.imageUrl && data.imagePosition !== 'none';

  return (
    <div className="bg-white dark:bg-slate-900 px-8 py-12">
      <div className={cn(
        hasImage && (data.imagePosition === 'left' || data.imagePosition === 'right') && 'flex gap-8 items-start',
        hasImage && data.imagePosition === 'left' && 'flex-row-reverse',
      )}>
        <div className="flex-1">
          {data.heading && (
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{data.heading}</h2>
          )}
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400"
            dangerouslySetInnerHTML={{ __html: data.bodyHtml || '<p>Content goes here...</p>' }}
          />
        </div>
        {hasImage && data.imagePosition !== 'background' && (
          <div className="w-1/3 flex-shrink-0">
            <img src={data.imageUrl} alt="" className="w-full rounded-lg object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
