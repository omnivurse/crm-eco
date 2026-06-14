/**
 * Dependent coverage periods — membership-level add/remove tracking with dates.
 * Supports children on/off for school, summer work, age-out, and back-dated history.
 */

import type { DependentCoveragePeriod } from '../types';

export const COVERAGE_REASONS = [
  'initial_enrollment',
  'resumed',
  'school_break',
  'summer_employment',
  'age_out',
  'marriage',
  'manual_removal',
  'historical_period',
  'correction',
  'other',
] as const;

export type CoverageReason = (typeof COVERAGE_REASONS)[number];

export const COVERAGE_SOURCES = [
  'portal',
  'crm',
  'admin',
  'import',
  'system',
  'migration',
] as const;

export type CoverageSource = (typeof COVERAGE_SOURCES)[number];

export interface DependentWithCoverage {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  relationship: string;
  included_in_enrollment: boolean | null;
  created_at: string | null;
  updated_at?: string | null;
}

export interface CoverageChangeSummary {
  id: string;
  dependent_id: string;
  dependent_name: string;
  effective_from: string;
  effective_to: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  change_type: 'added' | 'removed' | 'historical';
}

/** ISO date (YYYY-MM-DD) for today in local-less UTC slice (matches portal date inputs). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatCoverageReason(reason: string | null | undefined): string {
  if (!reason) return '';
  return reason.replace(/_/g, ' ');
}

export function formatCoverageDateRange(
  from: string,
  to: string | null | undefined,
): string {
  const start = new Date(from).toLocaleDateString();
  if (!to) return `${start} – present`;
  return `${start} – ${new Date(to).toLocaleDateString()}`;
}

/**
 * Whether a dependent is covered on `asOfDate` based on period rows.
 * Falls back to `included_in_enrollment` when no periods exist (migration compat).
 */
export function isDependentCurrentlyCovered(
  dependentId: string,
  periods: Pick<DependentCoveragePeriod, 'dependent_id' | 'effective_from' | 'effective_to'>[],
  fallbackIncluded?: boolean | null,
  asOfDate: string = todayIso(),
): boolean {
  const depPeriods = periods.filter((p) => p.dependent_id === dependentId);
  if (depPeriods.length === 0) return !!fallbackIncluded;
  return depPeriods.some((p) => {
    const from = p.effective_from;
    const to = p.effective_to;
    return from <= asOfDate && (to === null || to >= asOfDate);
  });
}

export function getCoverageHistoryForDependent(
  dependentId: string,
  periods: DependentCoveragePeriod[],
): DependentCoveragePeriod[] {
  return periods
    .filter((p) => p.dependent_id === dependentId)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
}

export function getOpenCoveragePeriod(
  dependentId: string,
  periods: DependentCoveragePeriod[],
): DependentCoveragePeriod | null {
  return (
    periods
      .filter((p) => p.dependent_id === dependentId && !p.effective_to)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null
  );
}

export function countCurrentlyCoveredDependents(
  dependents: Pick<DependentWithCoverage, 'id' | 'included_in_enrollment'>[],
  periods: Pick<DependentCoveragePeriod, 'dependent_id' | 'effective_from' | 'effective_to'>[],
  asOfDate: string = todayIso(),
): number {
  return dependents.filter((d) =>
    isDependentCurrentlyCovered(d.id, periods, d.included_in_enrollment, asOfDate),
  ).length;
}

export function summarizeRecentCoverageChanges(
  dependents: Pick<DependentWithCoverage, 'id' | 'first_name' | 'last_name'>[],
  periods: DependentCoveragePeriod[],
  limit = 5,
): CoverageChangeSummary[] {
  const depName = (id: string) => {
    const d = dependents.find((x) => x.id === id);
    return d ? `${d.first_name} ${d.last_name}` : 'Unknown';
  };

  return [...periods]
    .sort((a, b) => {
      const aTs = new Date(a.created_at).getTime();
      const bTs = new Date(b.created_at).getTime();
      return bTs - aTs;
    })
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      dependent_id: p.dependent_id,
      dependent_name: depName(p.dependent_id),
      effective_from: p.effective_from,
      effective_to: p.effective_to,
      reason: p.reason,
      notes: p.notes,
      created_at: p.created_at,
      change_type: p.effective_to
        ? 'historical'
        : ('added' as const),
    }));
}

export function validateCoverageDate(date: string | undefined, label: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${label} is required (YYYY-MM-DD)`;
  }
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return `${label} is not a valid date`;
  return null;
}

export function validateCoverageDateRange(from: string, to?: string | null): string | null {
  if (to && from > to) return 'Start date must be on or before end date';
  return null;
}
