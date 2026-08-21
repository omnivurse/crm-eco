'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@crm-eco/ui/components/input';
import { cn } from '@crm-eco/ui/lib/utils';

interface AdvisorRow {
  advisor_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

function advisorLabel(row: AdvisorRow): string {
  const name = (row.advisor_name ?? '').trim();
  if (name) return name;
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
}

export function EnrolledByPicker({
  id,
  value,
  onChange,
  className,
  placeholder = 'Search producers…',
  'aria-label': ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    const q = value.trim();
    const params = new URLSearchParams({ is_active: 'true', limit: '40' });
    if (q.length >= 1) params.set('search', q);
    fetch(`/api/crm/advisors?${params}`, { signal: ctrl.signal, credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data?: AdvisorRow[] }) => {
        const next = (body.data ?? [])
          .map(advisorLabel)
          .filter((n) => n.length > 0);
        setNames([...new Set(next)]);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== 'AbortError') setNames([]);
      });
    return () => ctrl.abort();
  }, [value]);

  const visible = useMemo(() => names.slice(0, 12), [names]);

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
