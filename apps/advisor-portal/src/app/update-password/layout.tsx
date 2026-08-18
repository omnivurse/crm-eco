import { AdvisorAuthShell } from '@/components/auth/AdvisorAuthShell';

/**
 * VISUAL ONLY. This layout runs no auth logic — it wraps
 * update-password/page.tsx, which still owns the PASSWORD_RECOVERY listener,
 * the `getSession()` race against it, and `updateUser({ password })`,
 * untouched. The 8-character rule, both validation strings and the field ids
 * live in the shared `AuthUpdatePasswordForm` and were not edited here.
 *
 * Same change as the reset-password layout: the hero moved to
 * `AdvisorAuthShell`, and the hard-coded hex gradient is gone.
 */
export default function AdvisorUpdatePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdvisorAuthShell>{children}</AdvisorAuthShell>;
}
