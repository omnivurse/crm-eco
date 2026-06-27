'use client';

/**
 * DependentCoverageHistory — CRM record-shell binding of the shared
 * DependentCoveragePanel (packages/enrollment). Supplies the CRM singleton
 * Supabase browser client and the CRM coverage server actions (service-role
 * conduits). All UI/logic lives in the shared component; the CRM shell re-fetches
 * its own data on navigation, so no onChanged refresh is needed here.
 */

import { supabase } from '@/lib/supabase-client';
import { DependentCoveragePanel } from '@crm-eco/enrollment/components/DependentCoveragePanel';
import {
  crmAddDependentWithCoverage,
  crmEndDependentCoverage,
  crmLogHistoricalCoveragePeriod,
  crmStartDependentCoverage,
} from '@/app/crm/members/coverage-actions';

export interface DependentCoverageHistoryProps {
  memberId: string;
  className?: string;
  /** When true, hides staff edit controls (timeline only). */
  readOnly?: boolean;
}

export function DependentCoverageHistory(props: DependentCoverageHistoryProps) {
  return (
    <DependentCoveragePanel
      {...props}
      supabase={supabase}
      actions={{
        addDependent: crmAddDependentWithCoverage,
        startCoverage: crmStartDependentCoverage,
        endCoverage: crmEndDependentCoverage,
        logHistorical: crmLogHistoricalCoveragePeriod,
      }}
    />
  );
}
