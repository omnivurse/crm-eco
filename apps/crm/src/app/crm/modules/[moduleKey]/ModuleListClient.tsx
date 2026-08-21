'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { currentListReturnTo, withReturnTo } from '@/lib/crm/status-lanes';
import { ModuleShell } from '@/components/zoho/ModuleShell';
import { useModuleShellOptional } from '@/components/zoho/ModuleShellContext';
import { RecordTable } from '@/components/crm/records/RecordTable';
import { ListView } from '@/components/crm/views/ListView';
import { KanbanView } from '@/components/crm/views/KanbanView';
import { TimelineView } from '@/components/crm/views/TimelineView';
import { SplitView } from '@/components/crm/views/SplitView';
import { TreeView } from '@/components/crm/views/TreeView';
import { CalendarView } from '@/components/crm/views/CalendarView';
import type { CrmModule, CrmField, CrmView, CrmRecord, CrmTerritory, TreeGroupBy, CrmDealStage } from '@/lib/crm/types';
import type { AdvisorTreeData, AgentTreeData } from '@/lib/crm/queries';
import { pickDefaultListColumns } from '@/lib/crm/default-list-columns';

// Lazy-load ChartView (~150KB recharts) only when user switches to chart mode
const ChartView = dynamic(
  () => import('@/components/crm/views/ChartView').then(m => m.ChartView),
  { ssr: false }
);

interface ModuleListClientProps {
  module: CrmModule;
  records: CrmRecord[];
  fields: CrmField[];
  views: CrmView[];
  activeViewId?: string;
  totalCount: number;
  userRole?: string | null;
  /** Available territories for territory filter */
  territories?: CrmTerritory[];
  /** Advisor tree data for tree view (advisor mode) */
  advisorTreeData?: AdvisorTreeData | null;
  /** Agent tree data for tree view (agent mode) */
  agentTreeData?: AgentTreeData | null;
  /** Which field the tree groups by */
  treeGroupBy?: TreeGroupBy;
  /** Deal stages — only provided for the deals module, powers kanban columns. */
  dealStages?: CrmDealStage[];
  /** Same as `?search=` / module toolbar — single source of truth for tree filtering */
  moduleSearch?: string;
  listPager?: React.ReactNode;
}

// Inner component that consumes the ModuleShell context and renders the active view
function ModuleViewContent({
  records,
  fields,
  moduleKey,
  views,
  activeViewId,
  totalCount,
  advisorTreeData,
  agentTreeData,
  treeGroupBy,
  dealStages,
  moduleSearch,
}: {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  views: CrmView[];
  activeViewId?: string;
  totalCount: number;
  advisorTreeData?: AdvisorTreeData | null;
  agentTreeData?: AgentTreeData | null;
  treeGroupBy?: TreeGroupBy;
  dealStages?: CrmDealStage[];
  moduleSearch?: string;
}) {
  const router = useRouter();
  const shellContext = useModuleShellOptional();

  // Row click carries the current list URL so the record page's Back returns
  // to the same filters/page (same as the title link).
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listReturnTo = currentListReturnTo(pathname, searchParams?.toString());
  const handleRowClick = useCallback((recordId: string) => {
    router.push(withReturnTo(`/crm/r/${recordId}`, listReturnTo));
  }, [router, listReturnTo]);

  // Use visibleColumns from context if available, otherwise fall back to the
  // active view's columns, then to a small identity-first default (never every
  // field — members has 91 and that produced a ~16k px wide table).
  const activeView = views.find(v => v.id === activeViewId);
  const viewColumns = activeView?.columns;
  // How many filters the active saved view applies — lets the empty state
  // say "No contacts match this saved view" (with a Leave-view action) only
  // when the view actually narrows the list, and use `totalCount` to tell a
  // page-out-of-range apart from a genuine no-match.
  const activeViewFilterCount = activeView ? (activeView.filters?.length ?? 0) : undefined;
  const displayColumns = shellContext?.visibleColumns ||
    (viewColumns && viewColumns.length > 0 ? viewColumns : undefined) ||
    pickDefaultListColumns(fields);

  // Use selection state from context if available
  const selectedIds = shellContext?.selectedIds || new Set<string>();
  const setSelectedIds = shellContext?.setSelectedIds || (() => {});

  // Wire sort from context to RecordTable
  const currentSort = shellContext?.sortField
    ? { field: shellContext.sortField, direction: shellContext.sortDirection }
    : undefined;
  const handleSort = shellContext?.handleSortChange;

  // Determine active view mode
  const viewMode = shellContext?.viewMode || 'table';

  switch (viewMode) {
    case 'list':
      return (
        <ListView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={handleRowClick}
          onBulkDelete={shellContext?.requestDelete}
          totalCount={totalCount}
          activeViewFilterCount={activeViewFilterCount}
          fillParent
        />
      );

    case 'kanban':
      return (
        <KanbanView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
          stages={dealStages}
          onBulkDelete={shellContext?.requestDelete}
        />
      );

    case 'chart':
      return (
        <ChartView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
        />
      );

    case 'timeline':
      return (
        <TimelineView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
        />
      );

    case 'calendar':
      return (
        <CalendarView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
          stages={dealStages}
        />
      );

    case 'split':
      return (
        <SplitView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          displayColumns={displayColumns}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={handleRowClick}
          onBulkDelete={shellContext?.requestDelete}
          fillParent
        />
      );

    case 'tree':
      return (
        <TreeView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          moduleSearch={moduleSearch ?? ''}
          advisorTreeData={advisorTreeData}
          agentTreeData={agentTreeData}
          treeGroupBy={treeGroupBy}
          onRowClick={handleRowClick}
        />
      );

    case 'table':
    default:
      return (
        <RecordTable
          records={records}
          fields={fields}
          displayColumns={displayColumns}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onSort={handleSort}
          currentSort={currentSort}
          onBulkDelete={shellContext?.requestDelete}
          totalCount={totalCount}
          activeViewFilterCount={activeViewFilterCount}
          fillParent
        />
      );
  }
}

function ModuleListContent({
  module,
  records,
  fields,
  views,
  activeViewId,
  totalCount,
  userRole,
  territories,
  advisorTreeData,
  agentTreeData,
  treeGroupBy,
  dealStages,
  moduleSearch,
  listPager,
}: ModuleListClientProps) {
  return (
    <ModuleShell
      key={module.key}
      module={module}
      records={records}
      fields={fields}
      views={views}
      activeViewId={activeViewId}
      totalCount={totalCount}
      userRole={userRole}
      territories={territories}
      paneFooter={listPager}
    >
      <ModuleViewContent
        records={records}
        fields={fields}
        moduleKey={module.key}
        views={views}
        activeViewId={activeViewId}
        totalCount={totalCount}
        advisorTreeData={advisorTreeData}
        agentTreeData={agentTreeData}
        treeGroupBy={treeGroupBy}
        dealStages={dealStages}
        moduleSearch={moduleSearch}
      />
    </ModuleShell>
  );
}

export function ModuleListClient(props: ModuleListClientProps) {
  return <ModuleListContent {...props} />;
}
