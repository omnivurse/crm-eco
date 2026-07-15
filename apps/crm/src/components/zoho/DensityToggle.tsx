'use client';

import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import { AlignJustify, Check } from 'lucide-react';
import type { Density } from './ViewPreferencesContext';

interface DensityToggleProps {
  value: Density;
  onChange: (density: Density) => void;
  className?: string;
}

// 'compact' is the out-of-box default (power-user dense). The value 'default'
// stays as the internal key for the middle scale but is labelled "Cozy" so it
// doesn't read as the app default (which it no longer is).
const DENSITY_OPTIONS: { value: Density; label: string; description: string }[] = [
  { value: 'compact', label: 'Compact', description: 'Most rows — default' },
  { value: 'default', label: 'Cozy', description: 'Balanced spacing' },
  { value: 'comfortable', label: 'Comfortable', description: 'Most spacing' },
];

export function DensityToggle({ value, onChange, className }: DensityToggleProps) {
  const activeLabel = DENSITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 px-2.5 gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
            className
          )}
        >
          <AlignJustify className="w-4 h-4" />
          {/* Fixed min-width + left align so the label never reflows the toolbar
              when the density word changes (default <-> comfortable) — including
              the one-frame post-hydration adoption of a persisted value. */}
          <span className="hidden sm:inline-block min-w-[4.5rem] text-left text-xs">{activeLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Display density
        </div>
        {DENSITY_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center justify-between py-2 cursor-pointer',
              'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5',
              value === option.value && 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
            )}
          >
            <div>
              <div className="font-medium">{option.label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{option.description}</div>
            </div>
            {value === option.value && (
              <Check className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
