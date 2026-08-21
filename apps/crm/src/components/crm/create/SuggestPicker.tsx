'use client';

import { useMemo, useState } from 'react';
import { Input } from '@crm-eco/ui/components/input';
import { cn } from '@crm-eco/ui/lib/utils';

export function SuggestPicker({
  id,
  value,
  onChange,
  options,
  className,
  placeholder,
  'aria-label': ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  options: string[];
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const visible = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options;
    return list.slice(0, 12);
  }, [options, value]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={className}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onChange={(e) => onChange(e.target.value)}
      />
      {open && visible.length > 0 && (
        <ul
          className={cn(
            'absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-md',
            'dark:border-white/10 dark:bg-slate-900',
          )}
        >
          {visible.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
