export interface AbandonedEnrollmentCandidate {
  id: string;
  organization_id: string;
  status: string;
  updated_at: string;
  email?: string | null;
  alreadyEnrolled?: boolean;
}

export function planAbandonedEnrollmentReminders(
  rows: AbandonedEnrollmentCandidate[],
  opts: { staleBeforeIso: string; sendEnabled: boolean },
) {
  const stale = rows.filter(
    (row) =>
      (row.status === 'draft' || row.status === 'in_progress') &&
      row.updated_at < opts.staleBeforeIso &&
      !row.alreadyEnrolled,
  );
  return {
    stale: stale.length,
    toEnroll: opts.sendEnabled ? stale.filter((row) => !!row.email) : [],
    skippedNoEmail: opts.sendEnabled ? stale.filter((row) => !row.email).length : 0,
    dryRun: !opts.sendEnabled,
    enrollmentIds: stale.map((row) => row.id),
  };
}
