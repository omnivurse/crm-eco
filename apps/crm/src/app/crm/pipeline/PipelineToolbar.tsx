'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Filter, Plus, Settings2 } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@crm-eco/ui/components/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import type { ViewFilter } from '@/lib/crm/types';

export interface PipelineStageOption {
  key: string;
  name: string;
}

interface PipelineToolbarProps {
  stages: PipelineStageOption[];
  canEditStages: boolean;
  railOpen?: boolean;
  filterTitle?: string;
  filtersCount?: number;
  onToggleRail?: () => void;
  /** Dialog trigger shown below lg, where the docked rail is hidden. */
  filterDialog?: ReactNode;
}

function isValidViewFilter(f: unknown): f is ViewFilter {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  return typeof o.field === 'string' && typeof o.operator === 'string';
}

/** Merge stage constraint with any other URL filters (e.g. pasted advanced `filters` JSON). */
function filtersWithStage(
  previousFiltersParam: string | null,
  stageKey: string | ''
): ViewFilter[] {
  let existing: ViewFilter[] = [];
  if (previousFiltersParam) {
    try {
      const parsed = JSON.parse(previousFiltersParam);
      if (Array.isArray(parsed)) {
        existing = parsed.filter(isValidViewFilter);
      }
    } catch {
      /* ignore */
    }
  }
  const rest = existing.filter((f) => f.field !== 'stage');
  if (stageKey) {
    rest.push({ field: 'stage', operator: 'equals', value: stageKey });
  }
  return rest;
}

function readStageEqualsFromFilters(filtersParam: string | null): string {
  if (!filtersParam) return '';
  try {
    const parsed = JSON.parse(filtersParam);
    if (!Array.isArray(parsed)) return '';
    const row = parsed.find(
      (x: unknown) =>
        isValidViewFilter(x) && x.field === 'stage' && x.operator === 'equals'
    );
    return typeof row?.value === 'string' ? row.value : '';
  } catch {
    return '';
  }
}

export function PipelineToolbar({
  stages,
  canEditStages,
  railOpen = false,
  filterTitle = 'Filter Pipeline by',
  filtersCount = 0,
  onToggleRail,
  filterDialog,
}: PipelineToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customizeOpen, setCustomizeOpen] = useState(false);

  const applyStage = (stageKey: string) => {
    const next = new URLSearchParams(searchParams.toString());
    const merged = filtersWithStage(searchParams.get('filters'), stageKey);
    if (merged.length > 0) next.set('filters', JSON.stringify(merged));
    else next.delete('filters');
    const qs = next.toString();
    router.push(qs ? `/crm/pipeline?${qs}` : '/crm/pipeline');
  };

  const currentStage = readStageEqualsFromFilters(searchParams.get('filters'));

  const dealsMirrorHref = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', '1');
    const s = searchParams.get('search');
    const f = searchParams.get('filters');
    const sc = searchParams.get('scope');
    if (s) p.set('search', s);
    if (f) p.set('filters', f);
    if (sc) p.set('scope', sc);
    return `/crm/modules/deals?${p.toString()}`;
  }, [searchParams]);

  const dealsKanbanHref = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', '1');
    p.set('viewMode', 'kanban');
    const s = searchParams.get('search');
    const f = searchParams.get('filters');
    const sc = searchParams.get('scope');
    if (s) p.set('search', s);
    if (f) p.set('filters', f);
    if (sc) p.set('scope', sc);
    return `/crm/modules/deals?${p.toString()}`;
  }, [searchParams]);

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          aria-pressed={railOpen}
          aria-label={
            filtersCount > 0 ? `${filterTitle} (${filtersCount} active)` : filterTitle
          }
          className={cn(
            'hidden lg:inline-flex border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20',
            (railOpen || filtersCount > 0) && 'border-primary/40 bg-primary/10 text-primary',
          )}
          onClick={onToggleRail}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
          {filtersCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {filtersCount}
            </span>
          )}
        </Button>

        <div className="lg:hidden">{filterDialog}</div>

        <Select
          value={currentStage || '__any__'}
          onValueChange={(v) => applyStage(v === '__any__' ? '' : v)}
        >
          <SelectTrigger className="w-[160px] bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10">
            <SelectValue placeholder="Any stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any__">Any stage</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20"
          onClick={() => setCustomizeOpen(true)}
        >
          <Settings2 className="w-4 h-4 mr-2" />
          Customize
        </Button>

        <Button
          asChild
        >
          <Link href="/crm/modules/deals/new">
            <Plus className="w-4 h-4 mr-2" />
            New Deal
          </Link>
        </Button>
      </div>

      <Sheet open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <SheetContent side="right" className="flex flex-col w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Customize pipeline</SheetTitle>
            <SheetDescription>
              Tune how your team works the board and where to manage stage definitions.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 text-sm text-slate-600 dark:text-slate-300 py-2">
            {canEditStages ? (
              <p>
                Set optional <strong>column limits</strong> (WIP caps) from the{' '}
                <strong>gear icon</strong> on each column header. Counts turn amber at the limit
                and red if you exceed it.
              </p>
            ) : (
              <p>
                Column limits are configured by admins and managers from the gear icon on each
                column header (when your role allows it).
              </p>
            )}

            <p>
              Stage names, order, and colors are driven by your org&rsquo;s deal stage catalog in
              the database — use the resources below to align the team.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href="/crm/learn/deals/stages">
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Learn: managing deal stages
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={dealsMirrorHref}>
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Open in Deals (table)
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={dealsKanbanHref}>
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Deals module (Kanban view)
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
