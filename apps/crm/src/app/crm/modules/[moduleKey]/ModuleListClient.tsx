'use client';

import { useState, useCallback } from 'react';
import { ModuleShell } from '@/components/zoho/ModuleShell';
import { RecordDrawer } from '@/components/zoho/RecordDrawer';
import { RecordDrawerProvider, useRecordDrawer } from '@/components/zoho/RecordDrawerContext';
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

function ModuleListContent({
  module,
  records,
  fields,
  views,
  activeViewId,
  totalCount,
}: ModuleListClientProps) {
  const { openDrawer } = useRecordDrawer();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleRowClick = useCallback((recordId: string) => {
    openDrawer(recordId, module.key);
  }, [openDrawer, module.key]);

  const displayColumns = views.find(v => v.id === activeViewId)?.columns || 
    ['title', 'status', 'email', 'created_at'];

  return (
    <ModuleShell
      module={module}
      records={records}
      fields={fields}
      views={views}
      activeViewId={activeViewId}
      totalCount={totalCount}
    >
      <RecordTable
        records={records}
        fields={fields}
        displayColumns={displayColumns}
        moduleKey={module.key}
        onRowClick={handleRowClick}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
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
