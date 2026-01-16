'use client';

import { useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { AlertCircle, CheckCircle, Circle } from 'lucide-react';
import type { CrmField } from '@/lib/crm/types';

interface Blocker {
  fieldKey: string;
  fieldLabel: string;
  field: CrmField;
  currentValue: unknown;
  isResolved: boolean;
}

interface BlockersPanelProps {
  blockers: Blocker[];
  onBlockerResolve: (fieldKey: string, value: unknown) => void;
  className?: string;
}

export function BlockersPanel({
  blockers,
  onBlockerResolve,
  className,
}: BlockersPanelProps) {
  const resolvedCount = blockers.filter(b => b.isResolved).length;
  const allResolved = resolvedCount === blockers.length;

  if (blockers.length === 0) {
    return (
      <div className={cn('p-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20', className)}>
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">No blockers - ready to proceed</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Status header */}
      <div className={cn(
        'flex items-center gap-2 text-sm font-medium',
        allResolved 
          ? 'text-emerald-700 dark:text-emerald-400' 
          : 'text-amber-700 dark:text-amber-400'
      )}>
        {allResolved ? (
          <>
            <CheckCircle className="w-4 h-4" />
            All requirements met
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            {blockers.length - resolvedCount} of {blockers.length} fields required
          </>
        )}
      </div>

      {/* Blocker list */}
      <div className="space-y-2">
        {blockers.map((blocker) => (
          <BlockerItem
            key={blocker.fieldKey}
            blocker={blocker}
            onResolve={(value) => onBlockerResolve(blocker.fieldKey, value)}
          />
        ))}
      </div>
    </div>
  );
}

function BlockerItem({
  blocker,
  onResolve,
}: {
  blocker: Blocker;
  onResolve: (value: unknown) => void;
}) {
  const [value, setValue] = useState<string>(
    blocker.currentValue !== null && blocker.currentValue !== undefined 
      ? String(blocker.currentValue) 
      : ''
  );

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onResolve(newValue || null);
  };

  const renderInput = () => {
    const { field } = blocker;

    if (field.type === 'select' && field.options?.length) {
      return (
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    const inputType = 
      field.type === 'number' || field.type === 'currency' ? 'number' :
      field.type === 'date' ? 'date' :
      field.type === 'datetime' ? 'datetime-local' :
      field.type === 'email' ? 'email' :
      'text';

    return (
      <Input
        type={inputType}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        className="h-9 text-sm bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10"
      />
    );
  };

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
      blocker.isResolved 
        ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10'
    )}>
      {/* Status icon */}
      <div className="flex-shrink-0">
        {blocker.isResolved ? (
          <CheckCircle className="w-5 h-5 text-emerald-500" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        )}
      </div>

      {/* Field input */}
      <div className="flex-1 min-w-0">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
          {blocker.fieldLabel}
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        {renderInput()}
      </div>
    </div>
  );
}
