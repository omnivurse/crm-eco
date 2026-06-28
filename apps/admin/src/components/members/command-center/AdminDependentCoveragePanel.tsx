'use client';

/**
 * AdminDependentCoveragePanel — admin Member Command Center binding of the shared
 * DependentCoveragePanel (packages/enrollment). Supplies the admin's Supabase
 * client, the admin coverage server actions (service-role conduits), and a
 * router.refresh() on success. All UI/logic lives in the shared component.
 */

import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { DependentCoveragePanel } from '@crm-eco/enrollment/components/DependentCoveragePanel';
import {
  adminAddDependentWithCoverage,
  adminEndDependentCoverage,
  adminLogHistoricalCoveragePeriod,
  adminStartDependentCoverage,
} from '@/app/(dashboard)/members/[id]/command-actions';

const supabase = createClient();

export interface DependentCoverageHistoryProps {
  memberId: string;
  className?: string;
  /** When true, hides staff edit controls (timeline only). */
  readOnly?: boolean;
}

export function AdminDependentCoveragePanel(props: DependentCoverageHistoryProps) {
  const router = useRouter();
  return (
    <DependentCoveragePanel
      {...props}
      supabase={supabase}
      onChanged={() => router.refresh()}
      actions={{
        addDependent: adminAddDependentWithCoverage,
        startCoverage: adminStartDependentCoverage,
        endCoverage: adminEndDependentCoverage,
        logHistorical: adminLogHistoricalCoveragePeriod,
      }}
    />
  );
}
