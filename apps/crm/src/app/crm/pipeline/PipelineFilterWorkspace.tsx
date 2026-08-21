'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FilterRailFrame } from '@/components/crm/filters/FilterRailFrame';
import { FilterSidebar } from '@/components/crm/filters/FilterSidebar';
import { FilterSidebarTrigger } from '@/components/crm/filters/FilterSidebarTrigger';
import type { CrmField, ViewFilter } from '@/lib/crm/types';
import {
  FILTER_RAIL_DEFAULT_OPEN,
  filterModuleByTitle,
  readFilterRailOpen,
  writeFilterRailOpen,
} from '@/lib/crm/filter-rail';
import { PipelineToolbar, type PipelineStageOption } from './PipelineToolbar';

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
  const [railOpen, setRailOpen] = useState(FILTER_RAIL_DEFAULT_OPEN);
  const title = filterModuleByTitle('Pipeline');

  useEffect(() => {
    setRailOpen(readFilterRailOpen(PIPELINE_RAIL_KEY));
  }, []);

  const toggleRail = useCallback(() => {
    setRailOpen((prev) => {
      const next = !prev;
      writeFilterRailOpen(PIPELINE_RAIL_KEY, next);
      return next;
    });
  }, []);

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

      <div className="flex items-start gap-3">
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
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
