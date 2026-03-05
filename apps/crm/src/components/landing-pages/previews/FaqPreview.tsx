'use client';

import { ChevronDown } from 'lucide-react';
import type { FaqSectionData } from '@/lib/landing-pages/types';

export function FaqPreview({ data }: { data: FaqSectionData }) {
  return (
    <div className="bg-white dark:bg-slate-900 px-8 py-12">
      {data.title && (
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-8">{data.title}</h2>
      )}
      <div className="max-w-2xl mx-auto space-y-3">
        {(data.items || []).map((item, i) => (
          <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.question}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
            {i === 0 && (
              <div className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
