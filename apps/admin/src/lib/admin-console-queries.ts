/**
 * Admin Console Stats -- Query layer for the admin enterprise dashboard.
 * Uses get_admin_console_stats RPC for single round-trip data retrieval.
 */

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { cache } from 'react';

// ============================================================================
// Types
// ============================================================================

/** Work queue item returned from the admin console RPC */
export interface AdminWorkQueueItem {
  id: string;
  type: 'billing_failure' | 'failed_job' | 'enrollment_review' | 'commission_payout' | 'overdue_task';
  title: string;
  subtitle: string;
  priority: number;
  createdAt: string;
}

/** Full admin console stats returned from get_admin_console_stats RPC */
export interface AdminConsoleStats {
  memberStats: {
    total: number;
    active: number;
    newThisMonth: number;
    inactiveThisMonth: number;
    retentionRate: number;
  };
  agentStats: {
    total: number;
    active: number;
    pendingOnboarding: number;
  };
  enrollmentStats: {
    total: number;
    pendingReview: number;
    approvedToday: number;
    rejectedToday: number;
    startedToday: number;
    expiringSoon: number;
    totalDraft: number;
  };
  billingStats: {
    collectedToday: number;
    mrr: number;
    failedToday: number;
    pendingAch: number;
    lastPaymentAt: string | null;
  };
  commissionStats: {
    pendingAmount: number;
    paidThisMonth: number;
    pendingPayouts: number;
  };
  systemStats: {
    failedJobs24h: number;
    runningJobs: number;
    pendingJobs: number;
  };
  pipelineCounts: {
    leads: number;
    draft: number;
    inProgress: number;
    submitted: number;
    approved: number;
  };
  workQueue: AdminWorkQueueItem[];
}

/** Default empty stats used when the RPC call fails */
const EMPTY_ADMIN_STATS: AdminConsoleStats = {
  memberStats: { total: 0, active: 0, newThisMonth: 0, inactiveThisMonth: 0, retentionRate: 0 },
  agentStats: { total: 0, active: 0, pendingOnboarding: 0 },
  enrollmentStats: { total: 0, pendingReview: 0, approvedToday: 0, rejectedToday: 0, startedToday: 0, expiringSoon: 0, totalDraft: 0 },
  billingStats: { collectedToday: 0, mrr: 0, failedToday: 0, pendingAch: 0, lastPaymentAt: null },
  commissionStats: { pendingAmount: 0, paidThisMonth: 0, pendingPayouts: 0 },
  systemStats: { failedJobs24h: 0, runningJobs: 0, pendingJobs: 0 },
  pipelineCounts: { leads: 0, draft: 0, inProgress: 0, submitted: 0, approved: 0 },
  workQueue: [],
};

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetch all admin console stats in a single RPC round-trip.
 */
export async function getAdminConsoleStats(orgId: string): Promise<AdminConsoleStats> {
  const supabase = await createServerSupabaseClient();

  // RPC is not yet in generated types -- use type assertion until `supabase gen types` is re-run
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_admin_console_stats', {
    p_org_id: orgId,
  }) as { data: Record<string, any> | null; error: { message: string } | null };

  if (error) {
    console.error('[getAdminConsoleStats] RPC error:', error);
    return EMPTY_ADMIN_STATS;
  }

  return {
    memberStats: {
      total: data?.memberStats?.total ?? 0,
      active: data?.memberStats?.active ?? 0,
      newThisMonth: data?.memberStats?.newThisMonth ?? 0,
      inactiveThisMonth: data?.memberStats?.inactiveThisMonth ?? 0,
      retentionRate: data?.memberStats?.retentionRate ?? 0,
    },
    agentStats: {
      total: data?.agentStats?.total ?? 0,
      active: data?.agentStats?.active ?? 0,
      pendingOnboarding: data?.agentStats?.pendingOnboarding ?? 0,
    },
    enrollmentStats: {
      total: data?.enrollmentStats?.total ?? 0,
      pendingReview: data?.enrollmentStats?.pendingReview ?? 0,
      approvedToday: data?.enrollmentStats?.approvedToday ?? 0,
      rejectedToday: data?.enrollmentStats?.rejectedToday ?? 0,
      startedToday: data?.enrollmentStats?.startedToday ?? 0,
      expiringSoon: data?.enrollmentStats?.expiringSoon ?? 0,
      totalDraft: data?.enrollmentStats?.totalDraft ?? 0,
    },
    billingStats: {
      collectedToday: Number(data?.billingStats?.collectedToday ?? 0),
      mrr: Number(data?.billingStats?.mrr ?? 0),
      failedToday: data?.billingStats?.failedToday ?? 0,
      pendingAch: data?.billingStats?.pendingAch ?? 0,
      lastPaymentAt: data?.billingStats?.lastPaymentAt ?? null,
    },
    commissionStats: {
      pendingAmount: Number(data?.commissionStats?.pendingAmount ?? 0),
      paidThisMonth: Number(data?.commissionStats?.paidThisMonth ?? 0),
      pendingPayouts: data?.commissionStats?.pendingPayouts ?? 0,
    },
    systemStats: {
      failedJobs24h: data?.systemStats?.failedJobs24h ?? 0,
      runningJobs: data?.systemStats?.runningJobs ?? 0,
      pendingJobs: data?.systemStats?.pendingJobs ?? 0,
    },
    pipelineCounts: {
      leads: data?.pipelineCounts?.leads ?? 0,
      draft: data?.pipelineCounts?.draft ?? 0,
      inProgress: data?.pipelineCounts?.inProgress ?? 0,
      submitted: data?.pipelineCounts?.submitted ?? 0,
      approved: data?.pipelineCounts?.approved ?? 0,
    },
    workQueue: (data?.workQueue ?? []) as AdminWorkQueueItem[],
  };
}

/**
 * Per-request memoized version of getAdminConsoleStats.
 */
export const getCachedAdminConsoleStats = cache(
  async (orgId: string) => getAdminConsoleStats(orgId)
);
