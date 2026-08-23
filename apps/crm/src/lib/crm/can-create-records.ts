/**
 * Who may create CRM records (DE-M1).
 *
 * One predicate for every create affordance — "+ Create" / "Add Member" in
 * the top bar, the ModuleHeader button, the quick-create drawer mount — so the
 * UI never offers create to `crm_viewer`. Mirrors the server backstop in
 * `app/api/crm/records/route.ts` (POST → 403 for any other role); the API
 * check stays authoritative, this only stops the dead-end click.
 */

import { isCrmManagerOrAdminRole } from '@/lib/crm/nav-profile';

export const CREATE_RECORD_ROLES = ['crm_admin', 'crm_manager', 'crm_agent'] as const;

export type CreateRecordRole = (typeof CREATE_RECORD_ROLES)[number];

/** True for crm_admin / crm_manager / crm_agent; false for viewer, null, unknown. */
export function canCreateRecords(crmRole: string | null | undefined): crmRole is CreateRecordRole {
  return typeof crmRole === 'string' && (CREATE_RECORD_ROLES as readonly string[]).includes(crmRole);
}

/**
 * PERM-1: who may DELETE a record or bulk-edit a selection.
 *
 * The manager-only record routes answer 403 to `crm_agent`:
 *   • DELETE /api/crm/records/[id]   (route.ts:145)
 *   • PATCH  /api/crm/records/bulk   (route.ts:94)  — Status / Assign / Stage
 *   • DELETE /api/crm/records/bulk   (route.ts:434)
 * so every affordance that ends in one of them must be hidden for agents,
 * the same way `canCreateRecords` hides create from `crm_viewer`. Delegates
 * to `isCrmManagerOrAdminRole` — one source of truth for the role pair.
 *
 * NOTE the routes that stay open to `crm_agent` and must NOT use this:
 * POST /api/crm/tags (Add Tag), the export GET, and the email composer.
 */
export function canManageRecords(crmRole: string | null | undefined): boolean {
  return isCrmManagerOrAdminRole(crmRole);
}
