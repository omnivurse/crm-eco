import { ALL_PERMISSION_KEYS, Permissions, type PermissionKey } from './keys';

/**
 * Temporary client/server bridge mirroring `_org_role_implies_permission`.
 * Used when `list_org_permissions` / `has_org_permission` RPCs are not yet applied,
 * and as a sync seed for CanProvider before the API returns.
 *
 * Remove when crm_user_roles coverage is complete (ADR 0002).
 */
export function permissionsFromOrgRole(
  role: string | null | undefined,
): PermissionKey[] {
  if (!role) return [];

  if (role === 'owner' || role === 'super_admin' || role === 'admin') {
    return [...ALL_PERMISSION_KEYS];
  }

  if (role === 'staff') {
    return [Permissions.PayablesRead, Permissions.PayablesCreate];
  }

  if (role === 'read_only') {
    return [Permissions.PayablesRead];
  }

  return [];
}

export function orgRoleImpliesPermission(
  role: string | null | undefined,
  permissionKey: string,
): boolean {
  return permissionsFromOrgRole(role).includes(permissionKey as PermissionKey);
}
