'use client';

import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  type CoverageSnapshotLayoutPrefs,
  coverageSnapshotModuleLabel,
  normalizeCoverageSnapshotOrder,
  moveCoverageSnapshotKey,
  toggleCoverageSnapshotHidden,
} from '@/lib/crm/coverage-snapshot-layout';

export interface CoverageSnapshotOrganizerField {
  key: string;
  label: string;
  required?: boolean;
}

interface CoverageSnapshotOrganizerProps {
  moduleKey: string;
  fields: CoverageSnapshotOrganizerField[];
  prefs: CoverageSnapshotLayoutPrefs | null;
  onSave: (next: CoverageSnapshotLayoutPrefs) => void;
  onReset: () => void;
  /** Popover heading. Defaults to "Card fields". */
  title?: string;
  /** Natural card order when nothing is stored. Snapshot uses the premium default. */
  defaultOrder?: readonly string[];
  testId?: string;
}

export function CoverageSnapshotOrganizer({
  moduleKey,
  fields,
  prefs,
  onSave,
  onReset,
  title = 'Card fields',
  defaultOrder,
  testId = 'crm-record-snapshot-organize',
}: CoverageSnapshotOrganizerProps) {
  const typeLabel = coverageSnapshotModuleLabel(moduleKey);
  const order = normalizeCoverageSnapshotOrder(
    fields.map((f) => f.key),
    prefs?.order,
    defaultOrder,
  );
  const hidden = new Set(prefs?.hidden ?? []);
  const byKey = new Map(fields.map((f) => [f.key, f]));

  const persist = (nextOrder: string[], nextHidden: string[]) => {
    onSave({ v: 1, order: nextOrder, hidden: nextHidden });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2.5 text-xs font-semibold text-teal-800 border-teal-300 bg-white/90 shadow-sm hover:bg-white hover:text-teal-950 dark:border-teal-500/40 dark:bg-slate-900/80 dark:text-teal-200"
          aria-label={`Organize card fields for all ${typeLabel} records`}
          title={`Customize fields for every ${typeLabel} record`}
          data-testid={testId}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Organize fields
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/5">
          <div className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-white">
              {title}
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              All {typeLabel} records
            </span>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal-700"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
        <ol className="max-h-80 overflow-y-auto py-1">
          {order.map((key, index) => {
            const field = byKey.get(key);
            if (!field) return null;
            const isHidden = hidden.has(key);
            return (
              <li
                key={key}
                className={cn(
                  'flex items-center gap-1 px-2 py-1',
                  isHidden && 'opacity-50',
                )}
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={`Move ${field.label} up`}
                    disabled={index === 0}
                    onClick={() => persist(moveCoverageSnapshotKey(order, key, -1), [...hidden])}
                    className="rounded p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 dark:hover:text-white"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${field.label} down`}
                    disabled={index === order.length - 1}
                    onClick={() => persist(moveCoverageSnapshotKey(order, key, 1), [...hidden])}
                    className="rounded p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 dark:hover:text-white"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-800 dark:text-slate-200">
                  {field.label}
                </span>
                <button
                  type="button"
                  aria-label={
                    field.required
                      ? `${field.label} is required and always shown`
                      : isHidden
                        ? `Show ${field.label}`
                        : `Hide ${field.label}`
                  }
                  disabled={field.required}
                  onClick={() => persist(order, toggleCoverageSnapshotHidden([...hidden], key))}
                  className="rounded p-1 text-slate-400 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </li>
            );
          })}
        </ol>
      </PopoverContent>
    </Popover>
  );
}
