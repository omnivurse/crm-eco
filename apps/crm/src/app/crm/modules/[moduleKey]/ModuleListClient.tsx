'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ModuleShell } from '@/components/zoho/ModuleShell';
import { useModuleShellOptional } from '@/components/zoho/ModuleShellContext';
import { RecordTable } from '@/components/crm/records/RecordTable';
import { ListView } from '@/components/crm/views/ListView';
import { KanbanView } from '@/components/crm/views/KanbanView';
import { TimelineView } from '@/components/crm/views/TimelineView';
import { SplitView } from '@/components/crm/views/SplitView';
import { TreeView } from '@/components/crm/views/TreeView';
import type { CrmModule, CrmField, CrmView, CrmRecord, CrmTerritory, TreeGroupBy } from '@/lib/crm/types';
import type { AdvisorTreeData } from '@/lib/crm/queries';

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
  /** Which field the tree groups by */
  treeGroupBy?: TreeGroupBy;
}

// Inner component that consumes the ModuleShell context and renders the active view
function ModuleViewContent({
  records,
  fields,
  moduleKey,
  views,
  activeViewId,
  advisorTreeData,
  treeGroupBy,
}: {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  views: CrmView[];
  activeViewId?: string;
  advisorTreeData?: AdvisorTreeData | null;
  treeGroupBy?: TreeGroupBy;
}) {
  const router = useRouter();
  const shellContext = useModuleShellOptional();

  const handleRowClick = useCallback((recordId: string) => {
    router.push(`/crm/r/${recordId}`);
  }, [router]);

  // Use visibleColumns from context if available, otherwise fall back to view/all fields
  const displayColumns = shellContext?.visibleColumns ||
    views.find(v => v.id === activeViewId)?.columns ||
    fields.map(f => f.key);

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
        />
      );

    case 'kanban':
      return (
        <KanbanView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
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
        />
      );

    case 'tree':
      return (
        <TreeView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          advisorTreeData={advisorTreeData}
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
  treeGroupBy,
}: ModuleListClientProps) {
  return (
    <ModuleShell
      module={module}
      records={records}
      fields={fields}
      views={views}
      activeViewId={activeViewId}
      totalCount={totalCount}
      userRole={userRole}
      territories={territories}
    >
      <ModuleViewContent
        records={records}
        fields={fields}
        moduleKey={module.key}
        views={views}
        activeViewId={activeViewId}
        advisorTreeData={advisorTreeData}
        treeGroupBy={treeGroupBy}
      />
    </ModuleShell>
  );
}

export function ModuleListClient(props: ModuleListClientProps) {
  return <ModuleListContent {...props} />;
}
