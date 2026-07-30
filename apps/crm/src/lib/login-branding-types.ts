/** Sticky org selection cookie — shared by CRM shell and login (client-safe constant). */
export const ACTIVE_ORG_COOKIE = 'dh_active_org';

/** Shared login branding shape (safe for client + server). */
export interface LoginBrandingContext {
  organizationId: string;
  organizationSlug: string | null;
  orgName: string | null;
  branding: Record<string, unknown>;
}

/** Only allow in-app CRM paths after login (blocks open redirects). */
export function safeCrmRedirect(path: string | null | undefined): string {
  if (!path) return '/crm';
  if (!path.startsWith('/crm') || path.startsWith('//')) return '/crm';
  // Backslashes and control characters are normalised inconsistently by
  // browsers and can smuggle a host past the prefix check
  // (e.g. "/crm\@evil.example.com"), turning a post-login or post-MFA
  // redirect into an open-redirect gadget.
  if (/[\\\u0000-\u001f]/.test(path)) return '/crm';
  return path;
}
