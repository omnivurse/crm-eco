'use client';

import { useSearchParams } from 'next/navigation';
import DataJobsTab from './DataJobsTab';
import SignalsTab from './SignalsTab';
import ExportTab from './ExportTab';
import AuditLogsTab from './AuditLogsTab';

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  jobs: DataJobsTab,
  signals: SignalsTab,
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
