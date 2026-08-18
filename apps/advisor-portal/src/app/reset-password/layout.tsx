import { AdvisorAuthShell } from '@/components/auth/AdvisorAuthShell';

/**
 * VISUAL ONLY. This layout runs no auth logic — it wraps
 * reset-password/page.tsx, which still owns `resetPasswordForEmail` and the
 * `${window.location.origin}/update-password` redirect, untouched. The form
 * itself is the shared `AuthResetPasswordForm`; its field id, autocomplete,
 * email normalisation and every string of copy are unchanged.
 *
 * The hero moved to `AdvisorAuthShell` so all three auth routes stop drifting.
 * The hex gradient that used to live here (`from-[#5eead4] via-[#67e8f9]
 * to-[#a7f3d0]`) is gone: it was a fixed light-theme value that could not
 * follow the palette or the theme, and it did not match the landings.
 */
export default function AdvisorResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdvisorAuthShell>{children}</AdvisorAuthShell>;
}
