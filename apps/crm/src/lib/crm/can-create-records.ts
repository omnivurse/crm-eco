/**
 * Who may create CRM records (DE-M1).
 *
 * One predicate for every create affordance — "+ Create" / "Add Member" in
 * the top bar, the ModuleHeader button, the quick-create drawer mount — so the
 * UI never offers create to `crm_viewer`. Mirrors the server backstop in
 * `app/api/crm/records/route.ts` (POST → 403 for any other role); the API
 * check stays authoritative, this only stops the dead-end click.
 */

export const CREATE_RECORD_ROLES = ['crm_admin', 'crm_manager', 'crm_agent'] as const;

export type CreateRecordRole = (typeof CREATE_RECORD_ROLES)[number];

/** True for crm_admin / crm_manager / crm_agent; false for viewer, null, unknown. */
export function canCreateRecords(crmRole: string | null | undefined): crmRole is CreateRecordRole {
  return typeof crmRole === 'string' && (CREATE_RECORD_ROLES as readonly string[]).includes(crmRole);
}
