export const REFUND_ROLES = ['owner', 'super_admin', 'admin'] as const;

export interface RefundCallerProfile {
  role: string | null;
  is_active: boolean | null;
}

/**
 * Refunds move real money and must never be available to ordinary members.
 * Legacy null activity values remain compatible; explicit deactivation denies.
 */
export function canProcessRefund(
  profile: RefundCallerProfile | null | undefined,
): boolean {
  return (
    profile?.is_active !== false &&
    typeof profile?.role === 'string' &&
    REFUND_ROLES.includes(profile.role as (typeof REFUND_ROLES)[number])
  );
}
