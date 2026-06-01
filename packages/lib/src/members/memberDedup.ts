/**
 * Member find-or-create helpers for enrollment flows.
 *
 * After a soft-merge (merged_into_id set), the keeper and duplicate rows can
 * share the same (email, first_name, last_name). Callers must exclude merged
 * rows when matching so enrollments attach to the canonical active member.
 */

export type MemberNameMatchRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  merged_into_id?: string | null;
};

/** Normalize for case-insensitive name comparison. */
export function normalizeMemberNamePart(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Pick the active (non-merged) member from an email cohort by first+last name.
 * Prefer filtering with `.is('merged_into_id', null)` at query time; this also
 * guards merged rows if a caller omits that filter.
 */
export function pickActiveMemberByName(
  rows: MemberNameMatchRow[],
  firstName: string,
  lastName: string,
): MemberNameMatchRow | undefined {
  const fn = normalizeMemberNamePart(firstName);
  const ln = normalizeMemberNamePart(lastName);

  return rows.find(
    (member) =>
      member.merged_into_id == null &&
      normalizeMemberNamePart(member.first_name) === fn &&
      normalizeMemberNamePart(member.last_name) === ln,
  );
}
