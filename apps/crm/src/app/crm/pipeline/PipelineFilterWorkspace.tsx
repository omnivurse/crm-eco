'use client';

import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FilterRailFrame } from '@/components/crm/filters/FilterRailFrame';
import { FilterSidebar } from '@/components/crm/filters/FilterSidebar';
import { FilterSidebarTrigger } from '@/components/crm/filters/FilterSidebarTrigger';
import { FilterWorkspaceRow } from '@/components/crm/filters/FilterWorkspaceRow';
import type { CrmField, ViewFilter } from '@/lib/crm/types';
import {
  FILTER_RAIL_DEFAULT_OPEN,
  filterModuleByTitle,
  readFilterRailOpen,
  subscribeFilterRailOpen,
  writeFilterRailOpen,
} from '@/lib/crm/filter-rail';
import { PipelineToolbar, type PipelineStageOption } from './PipelineToolbar';
import { useClientAuth } from '@/hooks/useClientAuth';

const PIPELINE_RAIL_KEY = 'pipeline';

interface PipelineFilterWorkspaceProps {
  fields: CrmField[];
  orgId: string;
  filters: ViewFilter[];
  stages: PipelineStageOption[];
  canEditStages: boolean;
  children: ReactNode;
}

export function PipelineFilterWorkspace({
  fields,
  orgId,
  filters,
  stages,
  canEditStages,
  children,
}: PipelineFilterWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = filterModuleByTitle('Pipeline');
  // LS-8: rail state is scoped to the viewer (filterRailStorageKey(module, profile))
  // — without a profile id read/write fail closed and nothing persists. Same
  // client-cached profile + useSyncExternalStore pattern as ModuleShell, so
  // there is no open-then-snap hydration flash either.
  const { profile } = useClientAuth();
  const viewerId = profile?.id ?? null;
  const storedRailOpen = useSyncExternalStore(
    subscribeFilterRailOpen,
    () => readFilterRailOpen(PIPELINE_RAIL_KEY, viewerId),
    () => FILTER_RAIL_DEFAULT_OPEN,
  );
  // Session-only fallback while the profile is still loading (write fails closed).
  const [fallbackOpen, setFallbackOpen] = useState(FILTER_RAIL_DEFAULT_OPEN);
  const railOpen = viewerId ? storedRailOpen : fallbackOpen;

  const toggleRail = useCallback(() => {
    if (viewerId) {
      writeFilterRailOpen(PIPELINE_RAIL_KEY, !storedRailOpen, viewerId);
    } else {
      setFallbackOpen((prev) => !prev);
    }
  }, [viewerId, storedRailOpen]);

  const applyFilters = useCallback(
    (next: ViewFilter[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.length > 0) params.set('filters', JSON.stringify(next));
      else params.delete('filters');
      const qs = params.toString();
      router.push(qs ? `/crm/pipeline?${qs}` : '/crm/pipeline');
    },
    [router, searchParams],
  );

  return (
    <>
      <PipelineToolbar
        stages={stages}
        canEditStages={canEditStages}
        railOpen={railOpen}
        filterTitle={title}
        filtersCount={filters.length}
        onToggleRail={toggleRail}
        filterDialog={
          <FilterSidebarTrigger
            fields={fields}
            filters={filters}
            orgId={orgId}
            moduleKey="deals"
            title={title}
            onFiltersChange={applyFilters}
          />
        }
      />

      <FilterWorkspaceRow
        rail={
          <FilterRailFrame
            open={railOpen}
            onToggle={toggleRail}
            title={title}
            activeCount={filters.length}
          >
            <FilterSidebar
              fields={fields}
              filters={filters}
              orgId={orgId}
              moduleKey="deals"
              title={title}
              variant="docked"
              onCollapse={toggleRail}
              onFiltersChange={applyFilters}
            />
          </FilterRailFrame>
        }
      >
        {children}
      </FilterWorkspaceRow>
    </>
  );
}
