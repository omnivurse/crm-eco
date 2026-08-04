'use client';

import { AlignJustify, Check } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { cn } from '../lib/utils';
import type { Density } from '../lib/density';

interface DensityToggleProps {
  value: Density;
  onChange: (density: Density) => void;
  className?: string;
}

/**
 * Display-density switcher, shared by the CRM and Admin consoles.
 *
 * 'compact' is the out-of-box default (power-user dense). The value 'default'
 * stays as the internal key for the middle scale but is labelled "Cozy" so it
 * doesn't read as the app default, which it no longer is.
 */
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
          className={cn('h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground', className)}
          aria-label={`Display density: ${activeLabel}`}
        >
          <AlignJustify className="h-4 w-4" aria-hidden="true" />
          {/* Fixed min-width + left align so the label never reflows the toolbar
              when the density word changes — including the one-frame
              post-hydration adoption of a persisted value. */}
          <span className="hidden min-w-[4.5rem] text-left text-xs sm:inline-block">
            {activeLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Display density
        </div>
        {DENSITY_OPTIONS.map((option) => {
          const isActive = value === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex cursor-pointer items-center justify-between py-2',
                isActive && 'bg-accent text-accent-foreground',
              )}
            >
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
              {/* Selection is carried by the check glyph, not colour alone. */}
              {isActive && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
