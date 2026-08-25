import type { CrmRole } from '@/lib/crm/types';

/**
 * System catalog role keys (crm_roles.key) → profiles.crm_role.
 * Used when assigning crm_user_roles so Security Control stays aligned
 * with live CRM API gates (has_crm_role).
 */
export const CATALOG_TO_CRM_ROLE: Record<string, CrmRole> = {
  admin: 'crm_admin',
  ceo: 'crm_admin',
  manager: 'crm_manager',
  advisor: 'crm_agent',
  support: 'crm_viewer',
};

export function crmRoleForCatalogKey(catalogKey: string): CrmRole | null {
  return CATALOG_TO_CRM_ROLE[catalogKey] ?? null;
}
