'use client';

import { useSearchParams } from 'next/navigation';
import DataJobsTab from './DataJobsTab';
import ExportTab from './ExportTab';
import AuditLogsTab from './AuditLogsTab';

// PHASE 2A — Signals tab deferred until the signals/segmentation feature
// is built out post-enrollment. The SignalsTab component is kept on disk
// so it can be re-added without rewriting.
const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  jobs: DataJobsTab,
  export: ExportTab,
  audit: AuditLogsTab,
};

export default function SystemHealthTabs() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');

  if (!tab || !TAB_COMPONENTS[tab]) {
    return null;
  }

  const TabComponent = TAB_COMPONENTS[tab];
  return <TabComponent />;
}
