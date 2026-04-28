'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Filter, Plus, Settings2 } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import type { ViewFilter } from '@/lib/crm/types';

export interface PipelineStageOption {
  key: string;
  name: string;
}

interface PipelineToolbarProps {
  stages: PipelineStageOption[];
  canEditStages: boolean;
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

export function PipelineToolbar({ stages, canEditStages }: PipelineToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterOpen, setFilterOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const [draftSearch, setDraftSearch] = useState('');
  const [draftStage, setDraftStage] = useState('');
  const [draftScope, setDraftScope] = useState<'all' | 'mine'>('all');

  const filtersActive = useMemo(() => {
    const search = (searchParams.get('search') || '').trim();
    const scope = searchParams.get('scope');
    const filters = searchParams.get('filters');
    if (search) return true;
    if (scope === 'mine' || scope === 'downline') return true;
    if (filters) {
      try {
        const p = JSON.parse(filters);
        return Array.isArray(p) && p.length > 0;
      } catch {
        return true;
      }
    }
    return false;
  }, [searchParams]);

  const syncDraftFromUrl = useCallback(() => {
    setDraftSearch(searchParams.get('search') || '');
    setDraftStage(readStageEqualsFromFilters(searchParams.get('filters')));
    const sc = searchParams.get('scope');
    setDraftScope(sc === 'mine' ? 'mine' : 'all');
  }, [searchParams]);

  const onFilterOpenChange = (open: boolean) => {
    setFilterOpen(open);
    if (open) syncDraftFromUrl();
  };

  const applyPipelineFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    if (draftSearch.trim()) next.set('search', draftSearch.trim());
    else next.delete('search');

    const merged = filtersWithStage(searchParams.get('filters'), draftStage);
    if (merged.length > 0) next.set('filters', JSON.stringify(merged));
    else next.delete('filters');

    if (draftScope === 'mine') next.set('scope', 'mine');
    else next.delete('scope');

    const qs = next.toString();
    router.push(qs ? `/crm/pipeline?${qs}` : '/crm/pipeline');
    setFilterOpen(false);
  };

  const clearPipelineFilters = () => {
    router.push('/crm/pipeline');
    setFilterOpen(false);
  };

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
          className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20"
          onClick={() => onFilterOpenChange(true)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
          {filtersActive && (
            <span
              className="ml-2 inline-flex h-2 w-2 rounded-full bg-teal-500"
              aria-hidden
            />
          )}
        </Button>

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
          className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-sm hover:shadow-md"
          asChild
        >
          <Link href="/crm/modules/deals/new">
            <Plus className="w-4 h-4 mr-2" />
            New Deal
          </Link>
        </Button>
      </div>

      <Sheet open={filterOpen} onOpenChange={onFilterOpenChange}>
        <SheetContent side="right" className="flex flex-col w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filter pipeline</SheetTitle>
            <SheetDescription>
              These options use the same <code className="text-xs">search</code>,{' '}
              <code className="text-xs">filters</code>, and <code className="text-xs">scope</code>{' '}
              parameters as the Deals module list, so results stay in sync.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 py-2 overflow-y-auto scrollbar-thin">
            <div className="space-y-2">
              <Label htmlFor="pipeline-search">Search deals</Label>
              <Input
                id="pipeline-search"
                type="search"
                placeholder="Title, email, phone…"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                className="bg-white dark:bg-slate-900/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={draftStage || '__any__'}
                onValueChange={(v) => setDraftStage(v === '__any__' ? '' : v)}
              >
                <SelectTrigger className="bg-white dark:bg-slate-900/50">
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
            </div>

            <div className="space-y-2">
              <Label>Ownership</Label>
              <Select
                value={draftScope}
                onValueChange={(v) => setDraftScope(v as 'all' | 'mine')}
              >
                <SelectTrigger className="bg-white dark:bg-slate-900/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All deals I can access</SelectItem>
                  <SelectItem value="mine">My deals only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              For saved views, bulk actions, and CSV export, open the full Deals workspace.
            </p>

            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={dealsMirrorHref}>
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Open in Deals (table)
              </Link>
            </Button>
          </div>

          <SheetFooter className="flex-col sm:flex-col gap-2 border-t border-slate-200 dark:border-white/10 pt-4">
            <div className="flex gap-2 w-full">
              <Button type="button" variant="outline" className="flex-1" onClick={clearPipelineFilters}>
                Clear all
              </Button>
              <Button
                type="button"
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white"
                onClick={applyPipelineFilters}
              >
                Apply
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
