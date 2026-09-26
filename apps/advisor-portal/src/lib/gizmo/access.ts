export interface AdvisorGizmoProfile {
  advisor_role: string | null;
  is_active: boolean | null;
}

/**
 * API routes bypass the advisor portal middleware, so record-search endpoints
 * must enforce profile deactivation themselves before reading member data.
 */
export function canUseAdvisorGizmo<T extends AdvisorGizmoProfile>(
  profile: T | null | undefined,
): profile is T & { advisor_role: string } {
  return (
    typeof profile?.advisor_role === 'string' &&
    profile.advisor_role.trim().length > 0 &&
    profile.is_active !== false
  );
}
