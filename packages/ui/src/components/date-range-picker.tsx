'use client';

import * as React from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import type { DateRange as DayPickerDateRange } from 'react-day-picker';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}

const DEFAULT_PRESETS: DateRangePreset[] = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { from: today, to: end };
    },
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const end = new Date(yesterday);
      end.setHours(23, 59, 59, 999);
      return { from: yesterday, to: end };
    },
  },
  {
    label: 'Last 7 Days',
    getValue: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: end };
    },
  },
  {
    label: 'Last 30 Days',
    getValue: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: end };
    },
  },
  {
    label: 'This Month',
    getValue: () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    },
  },
  {
    label: 'Last Month',
    getValue: () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    },
  },
  {
    label: 'This Year',
    getValue: () => {
      const start = new Date();
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    },
  },
];

function formatDate(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  presets?: DateRangePreset[];
  className?: string;
  placeholder?: string;
  align?: 'start' | 'center' | 'end';
}

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  className,
  placeholder = 'Select date range',
  align = 'start',
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<DateRange>({
    from: value?.from,
    to: value?.to,
  });

  React.useEffect(() => {
    setTempRange({ from: value?.from, to: value?.to });
  }, [value?.from, value?.to]);

  const handlePresetClick = (preset: DateRangePreset) => {
    const range = preset.getValue();
    setTempRange(range);
    onChange?.(range);
    setOpen(false);
  };

  const handleSelect = (range: DayPickerDateRange | undefined) => {
    if (!range) {
      setTempRange({ from: undefined, to: undefined });
      return;
    }
    const next: DateRange = {
      from: range.from,
      to: range.to
        ? (() => {
            const end = new Date(range.to);
            end.setHours(23, 59, 59, 999);
            return end;
          })()
        : undefined,
    };
    setTempRange(next);
  };

  const handleApply = () => {
    onChange?.(tempRange);
    setOpen(false);
  };

  const displayValue = React.useMemo(() => {
    if (!value?.from && !value?.to) return placeholder;
    if (value?.from && value?.to) {
      return `${formatDate(value.from)} - ${formatDate(value.to)}`;
    }
    if (value?.from) return `From ${formatDate(value.from)}`;
    if (value?.to) return `To ${formatDate(value.to)}`;
    return placeholder;
  }, [value, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value?.from && !value?.to && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">{displayValue}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex flex-col sm:flex-row">
          <div className="border-b sm:border-b-0 sm:border-r border-border p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
              Quick Select
            </p>
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground px-1">
              Custom Range
            </p>
            <Calendar
              mode="range"
              selected={{
                from: tempRange.from,
                to: tempRange.to,
              }}
              onSelect={handleSelect}
              numberOfMonths={1}
              defaultMonth={tempRange.from ?? value?.from}
            />
            <div className="flex gap-2 pt-1 px-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply} className="flex-1">
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
