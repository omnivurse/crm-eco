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
  return path;
}
