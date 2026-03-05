'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import { Check } from 'lucide-react';
import type { PricingSectionData } from '@/lib/landing-pages/types';

export function PricingPreview({ data }: { data: PricingSectionData }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-12">
      {data.title && (
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">{data.title}</h2>
      )}
      {data.subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8">{data.subtitle}</p>
      )}
      <div className={cn(
        'grid gap-6',
        (data.tiers?.length || 0) <= 3 ? 'grid-cols-3' : 'grid-cols-4',
      )}>
        {(data.tiers || []).map((tier) => (
          <div
            key={tier.id}
            className={cn(
              'bg-white dark:bg-slate-800 rounded-xl p-6 border-2 transition-shadow',
              tier.highlighted
                ? 'border-teal-500 shadow-lg shadow-teal-500/10 relative'
                : 'border-slate-200 dark:border-slate-700'
            )}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-teal-500 text-white text-[10px] font-bold uppercase rounded-full">
                Popular
              </div>
            )}
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{tier.planName}</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{tier.price}</span>
              <span className="text-sm text-slate-500">{tier.period}</span>
            </div>
            <ul className="space-y-2 mb-6">
              {(tier.features || []).map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className={cn(
              'w-full py-2 rounded-lg text-sm font-semibold transition-colors',
              tier.highlighted
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            )}>
              {tier.ctaText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
