'use client';

import { useCallback } from 'react';
import { ModuleShell } from '@/components/zoho/ModuleShell';
import { RecordDrawer } from '@/components/zoho/RecordDrawer';
import { RecordDrawerProvider, useRecordDrawer } from '@/components/zoho/RecordDrawerContext';
import { useModuleShellOptional } from '@/components/zoho/ModuleShellContext';
import { RecordTable } from '@/components/crm/records/RecordTable';
import type { CrmModule, CrmField, CrmView, CrmRecord } from '@/lib/crm/types';

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

  // Use visibleColumns from context if available, otherwise fall back to view/defaults
  const displayColumns = shellContext?.visibleColumns ||
    views.find(v => v.id === activeViewId)?.columns ||
    ['title', 'status', 'email', 'created_at'];

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
