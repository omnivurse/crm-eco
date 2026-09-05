/**
 * Who may change the email asset library.
 *
 * Shared by the API route and the page so the buttons a user sees match what
 * the server will actually accept. Previously the page offered Upload and
 * Delete to everyone and let the request come back 403, which read as a
 * broken feature rather than a permission boundary.
 */

export const ASSET_UPLOAD_ROLES = ['crm_admin', 'crm_manager', 'crm_agent'] as const;
export const ASSET_DELETE_ROLES = ['crm_admin', 'crm_manager'] as const;

export function canUploadEmailAssets(crmRole: string | null | undefined): boolean {
  return ASSET_UPLOAD_ROLES.includes((crmRole ?? '') as (typeof ASSET_UPLOAD_ROLES)[number]);
}

export function canDeleteEmailAssets(crmRole: string | null | undefined): boolean {
  return ASSET_DELETE_ROLES.includes((crmRole ?? '') as (typeof ASSET_DELETE_ROLES)[number]);
}
