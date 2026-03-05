'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import { Heart, Shield, DollarSign, Star, Zap, Users, type LucideIcon } from 'lucide-react';
import type { FeaturesSectionData } from '@/lib/landing-pages/types';

const featureIcons: Record<string, LucideIcon> = {
  heart: Heart, shield: Shield, 'dollar-sign': DollarSign,
  star: Star, zap: Zap, users: Users,
};

export function FeaturesPreview({ data }: { data: FeaturesSectionData }) {
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
        data.columns === 2 && 'grid-cols-2',
        data.columns === 3 && 'grid-cols-3',
        data.columns === 4 && 'grid-cols-4',
      )}>
        {(data.items || []).map((item) => {
          const Icon = featureIcons[item.icon] || Star;
          return (
            <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 text-center">
              <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1 text-sm">{item.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
