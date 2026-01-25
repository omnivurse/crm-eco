import { Award, TrendingUp, Users, FileText, ChevronRight } from 'lucide-react';
import type { AdvisorMilestoneProgress, AgentLevel } from 'shared';

interface MilestoneTrackerProps {
  progress: AdvisorMilestoneProgress;
  showDetails?: boolean;
}

export function MilestoneTracker({ progress, showDetails = true }: MilestoneTrackerProps) {
  const {
    currentLevel,
    nextLevel,
    progressPercent,
    activeMembersCount,
    monthlyEnrollmentsCount,
  } = progress;

  // Calculate individual metric progress
  const membersProgress = nextLevel?.minActiveMembers
    ? Math.min(100, (activeMembersCount / nextLevel.minActiveMembers) * 100)
    : 100;

  const enrollmentsProgress = nextLevel?.minMonthlyEnrollments
    ? Math.min(100, (monthlyEnrollmentsCount / nextLevel.minMonthlyEnrollments) * 100)
    : 100;

  const getProgressColor = (percent: number): string => {
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 75) return 'bg-teal-500';
    if (percent >= 50) return 'bg-yellow-500';
    if (percent >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-teal-500 rounded-xl flex items-center justify-center">
          <Award className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Milestone Progress
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Track your tier advancement
          </p>
        </div>
      </div>

      {/* Current to Next Level */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {currentLevel?.rank || 0}
            </span>
          </div>
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            {currentLevel?.name || 'Associate'}
          </p>
          <p className="text-xs text-neutral-500">Current</p>
        </div>

        <div className="flex-1 px-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getProgressColor(progressPercent)}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-neutral-900 dark:text-white min-w-[3rem] text-right">
              {progressPercent.toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-center">
            <ChevronRight className="w-5 h-5 text-neutral-400" />
          </div>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500/20 to-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-dashed border-primary-300 dark:border-primary-600">
            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {nextLevel?.rank || '?'}
            </span>
          </div>
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            {nextLevel?.name || 'Max Level'}
          </p>
          <p className="text-xs text-neutral-500">Next</p>
        </div>
      </div>

      {/* Detailed Metrics */}
      {showDetails && nextLevel && (
        <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          {/* Active Members Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Active Members
                </span>
              </div>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {activeMembersCount} / {nextLevel.minActiveMembers}
              </span>
            </div>
            <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getProgressColor(membersProgress)}`}
                style={{ width: `${membersProgress}%` }}
              />
            </div>
            {nextLevel.minActiveMembers - activeMembersCount > 0 && (
              <p className="text-xs text-neutral-500 mt-1">
                {nextLevel.minActiveMembers - activeMembersCount} more needed
              </p>
            )}
          </div>

          {/* Monthly Enrollments Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Monthly Enrollments
                </span>
              </div>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {monthlyEnrollmentsCount} / {nextLevel.minMonthlyEnrollments}
              </span>
            </div>
            <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getProgressColor(enrollmentsProgress)}`}
                style={{ width: `${enrollmentsProgress}%` }}
              />
            </div>
            {nextLevel.minMonthlyEnrollments - monthlyEnrollmentsCount > 0 && (
              <p className="text-xs text-neutral-500 mt-1">
                {nextLevel.minMonthlyEnrollments - monthlyEnrollmentsCount} more needed
              </p>
            )}
          </div>

          {/* Commission Rate Preview */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Commission Rate at {nextLevel.name}
              </span>
            </div>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              {nextLevel.commissionRate}%
            </span>
          </div>
        </div>
      )}

      {/* Max Level Reached */}
      {!nextLevel && currentLevel && (
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
            <Award className="w-5 h-5" />
            <span className="font-medium">Maximum tier reached!</span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center mt-2">
            Commission rate: {currentLevel.commissionRate}%
          </p>
        </div>
      )}
    </div>
  );
}

// Compact version for lists
interface MilestoneProgressBadgeProps {
  progress: AdvisorMilestoneProgress;
}

export function MilestoneProgressBadge({ progress }: MilestoneProgressBadgeProps) {
  const { currentLevel, progressPercent } = progress;

  const getProgressColor = (percent: number): string => {
    if (percent >= 100) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (percent >= 75) return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400';
    if (percent >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getProgressColor(progressPercent)}`}>
        {currentLevel?.name || 'Associate'}
      </span>
      <div className="flex items-center gap-1">
        <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-xs text-neutral-500">
          {progressPercent.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
