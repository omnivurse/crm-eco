import type { AgentLevel, AdvisorMilestoneProgress } from './types.js';

// ============================================================================
// MILESTONE CALCULATION TYPES
// ============================================================================

export interface AdvisorMetrics {
  advisorId: string;
  activeMembersCount: number;
  monthlyEnrollmentsCount: number;
  totalCommissions: number;
}

export interface MilestoneCalculationResult {
  advisorId: string;
  currentLevel: AgentLevel | null;
  nextLevel: AgentLevel | null;
  progressPercent: number;
  metricsSnapshot: AdvisorMetrics;
  activeMembersProgress: number;
  enrollmentsProgress: number;
  levelChanged: boolean;
  previousLevelId?: string;
}

export interface MilestoneNotification {
  type: 'level_up' | 'level_down' | 'progress_update' | 'near_milestone';
  advisorId: string;
  advisorName: string;
  message: string;
  currentLevel?: string;
  nextLevel?: string;
  progressPercent: number;
}

// ============================================================================
// MILESTONE SERVICE
// ============================================================================

/**
 * Calculate milestone progress for an advisor
 */
export function calculateMilestoneProgress(
  metrics: AdvisorMetrics,
  levels: AgentLevel[],
  currentLevelId?: string
): MilestoneCalculationResult {
  // Sort levels by rank
  const sortedLevels = [...levels].sort((a, b) => a.rank - b.rank);

  // Find current level
  const currentLevel = currentLevelId
    ? levels.find((l) => l.id === currentLevelId) || null
    : null;

  // Determine next level based on metrics
  let calculatedLevel: AgentLevel | null = null;
  let nextLevel: AgentLevel | null = null;

  for (const level of sortedLevels) {
    if (
      metrics.activeMembersCount >= level.minActiveMembers &&
      metrics.monthlyEnrollmentsCount >= level.minMonthlyEnrollments
    ) {
      calculatedLevel = level;
    }
  }

  // Find next level (one above current calculated level)
  if (calculatedLevel) {
    const currentRank = calculatedLevel.rank;
    nextLevel = sortedLevels.find((l) => l.rank === currentRank + 1) || null;
  } else {
    // If no level achieved, first level is the next target
    nextLevel = sortedLevels[0] || null;
  }

  // Calculate progress toward next level
  let progressPercent = 0;
  let activeMembersProgress = 100;
  let enrollmentsProgress = 100;

  if (nextLevel) {
    // Calculate progress for each metric
    const memberReq = nextLevel.minActiveMembers;
    const enrollReq = nextLevel.minMonthlyEnrollments;

    activeMembersProgress = memberReq > 0
      ? Math.min(100, (metrics.activeMembersCount / memberReq) * 100)
      : 100;

    enrollmentsProgress = enrollReq > 0
      ? Math.min(100, (metrics.monthlyEnrollmentsCount / enrollReq) * 100)
      : 100;

    // Overall progress is average of both metrics
    progressPercent = (activeMembersProgress + enrollmentsProgress) / 2;
  } else if (calculatedLevel) {
    // At max level
    progressPercent = 100;
  }

  // Determine if level changed
  const levelChanged = currentLevel?.id !== calculatedLevel?.id;

  return {
    advisorId: metrics.advisorId,
    currentLevel: calculatedLevel,
    nextLevel,
    progressPercent: Math.round(progressPercent * 100) / 100,
    metricsSnapshot: metrics,
    activeMembersProgress: Math.round(activeMembersProgress * 100) / 100,
    enrollmentsProgress: Math.round(enrollmentsProgress * 100) / 100,
    levelChanged,
    previousLevelId: currentLevel?.id,
  };
}

/**
 * Generate notification for milestone change
 */
export function generateMilestoneNotification(
  result: MilestoneCalculationResult,
  advisorName: string
): MilestoneNotification | null {
  if (result.levelChanged) {
    const previousRank = result.previousLevelId
      ? (result.metricsSnapshot as unknown as Record<string, number>)['previousRank'] || 0
      : 0;
    const newRank = result.currentLevel?.rank || 0;

    if (newRank > previousRank) {
      return {
        type: 'level_up',
        advisorId: result.advisorId,
        advisorName,
        message: `Congratulations! You've reached ${result.currentLevel?.name} tier!`,
        currentLevel: result.currentLevel?.name,
        nextLevel: result.nextLevel?.name,
        progressPercent: result.progressPercent,
      };
    } else {
      return {
        type: 'level_down',
        advisorId: result.advisorId,
        advisorName,
        message: `Your tier has changed to ${result.currentLevel?.name || 'Associate'}. Keep working to reach ${result.nextLevel?.name}!`,
        currentLevel: result.currentLevel?.name,
        nextLevel: result.nextLevel?.name,
        progressPercent: result.progressPercent,
      };
    }
  }

  // Check if near milestone (>=85% progress)
  if (result.progressPercent >= 85 && result.progressPercent < 100 && result.nextLevel) {
    return {
      type: 'near_milestone',
      advisorId: result.advisorId,
      advisorName,
      message: `You're ${result.progressPercent.toFixed(0)}% progress to ${result.nextLevel.name} tier!`,
      currentLevel: result.currentLevel?.name,
      nextLevel: result.nextLevel.name,
      progressPercent: result.progressPercent,
    };
  }

  return null;
}

/**
 * Calculate tier requirements breakdown
 */
export function getTierRequirementsBreakdown(
  metrics: AdvisorMetrics,
  nextLevel: AgentLevel | null
): {
  membersNeeded: number;
  enrollmentsNeeded: number;
  isQualified: boolean;
} {
  if (!nextLevel) {
    return {
      membersNeeded: 0,
      enrollmentsNeeded: 0,
      isQualified: true,
    };
  }

  const membersNeeded = Math.max(0, nextLevel.minActiveMembers - metrics.activeMembersCount);
  const enrollmentsNeeded = Math.max(0, nextLevel.minMonthlyEnrollments - metrics.monthlyEnrollmentsCount);

  return {
    membersNeeded,
    enrollmentsNeeded,
    isQualified: membersNeeded === 0 && enrollmentsNeeded === 0,
  };
}

/**
 * Convert database row to AdvisorMilestoneProgress
 */
export function mapDbRowToMilestoneProgress(
  row: Record<string, unknown>
): AdvisorMilestoneProgress {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    advisorId: row.advisor_id as string,
    currentLevelId: row.current_level_id as string | undefined,
    nextLevelId: row.next_level_id as string | undefined,
    activeMembersCount: row.active_members_count as number,
    monthlyEnrollmentsCount: row.monthly_enrollments_count as number,
    progressPercent: row.progress_percent as number,
    metricsSnapshot: row.metrics_snapshot as Record<string, unknown> | undefined,
    calculatedAt: row.calculated_at as string,
    currentLevel: row.current_level as AgentLevel | undefined,
    nextLevel: row.next_level as AgentLevel | undefined,
  };
}

/**
 * Convert AgentLevel database row
 */
export function mapDbRowToAgentLevel(row: Record<string, unknown>): AgentLevel {
  return {
    id: row.id as string,
    name: row.name as string,
    rank: row.rank as number,
    minActiveMembers: row.min_active_members as number,
    minMonthlyEnrollments: row.min_monthly_enrollments as number,
    commissionRate: row.commission_rate as number,
    description: row.description as string | undefined,
  };
}
