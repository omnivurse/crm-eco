'use client';

import { MessageCircle } from 'lucide-react';
import type { TestimonialsSectionData } from '@/lib/landing-pages/types';

export function TestimonialsPreview({ data }: { data: TestimonialsSectionData }) {
  return (
    <div className="bg-white dark:bg-slate-900 px-8 py-12">
      {data.title && (
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-8">{data.title}</h2>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {(data.items || []).map((item) => (
          <div key={item.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5">
            <MessageCircle className="w-5 h-5 text-teal-500 mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 italic">&ldquo;{item.quote}&rdquo;</p>
            <div className="flex items-center gap-3">
              {item.avatarUrl ? (
                <img src={item.avatarUrl} alt={item.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center text-teal-700 dark:text-teal-400 text-xs font-bold">
                  {item.name.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p>
                <p className="text-xs text-slate-500">{[item.role, item.company].filter(Boolean).join(', ')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
