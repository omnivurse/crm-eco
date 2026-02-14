'use client';

import { useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ModuleShell } from '@/components/zoho/ModuleShell';
import { RecordDrawerProvider, useRecordDrawer } from '@/components/zoho/RecordDrawerContext';
import { useModuleShellOptional } from '@/components/zoho/ModuleShellContext';
import { RecordTable } from '@/components/crm/records/RecordTable';
import type { CrmModule, CrmField, CrmView, CrmRecord } from '@/lib/crm/types';

// Lazy load RecordDrawer - only loaded when drawer is opened
// Reduces initial bundle by ~30KB+
const RecordDrawer = dynamic(
  () => import('@/components/zoho/RecordDrawer').then((mod) => mod.RecordDrawer),
  { ssr: false }
);

interface ModuleListClientProps {
  module: CrmModule;
  records: CrmRecord[];
  fields: CrmField[];
  views: CrmView[];
  activeViewId?: string;
  totalCount: number;
}

// Inner component that consumes the ModuleShell context
function ModuleTableContent({
  records,
  fields,
  moduleKey,
  views,
  activeViewId,
}: {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  views: CrmView[];
  activeViewId?: string;
}) {
  const { openDrawer } = useRecordDrawer();
  const shellContext = useModuleShellOptional();

  const handleRowClick = useCallback((recordId: string) => {
    openDrawer(recordId, moduleKey);
  }, [openDrawer, moduleKey]);

  // Use visibleColumns from context if available, otherwise fall back to view/all fields
  const displayColumns = shellContext?.visibleColumns ||
    views.find(v => v.id === activeViewId)?.columns ||
    fields.map(f => f.key);

  // Use selection state from context if available
  const selectedIds = shellContext?.selectedIds || new Set<string>();
  const setSelectedIds = shellContext?.setSelectedIds || (() => {});

  return (
    <RecordTable
      records={records}
      fields={fields}
      displayColumns={displayColumns}
      moduleKey={moduleKey}
      onRowClick={handleRowClick}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
    />
  );
}

function ModuleListContent({
  module,
  records,
  fields,
  views,
  activeViewId,
  totalCount,
}: ModuleListClientProps) {
  return (
    <ModuleShell
      module={module}
      records={records}
      fields={fields}
      views={views}
      activeViewId={activeViewId}
      totalCount={totalCount}
    >
      <ModuleTableContent
        records={records}
        fields={fields}
        moduleKey={module.key}
        views={views}
        activeViewId={activeViewId}
      />
    </ModuleShell>
  );
}

export function ModuleListClient(props: ModuleListClientProps) {
  return (
    <RecordDrawerProvider>
      <ModuleListContent {...props} />
      <RecordDrawer />
    </RecordDrawerProvider>
  );
}
