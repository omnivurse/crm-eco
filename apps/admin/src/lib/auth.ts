export type AdminRole = 'owner' | 'admin' | 'staff';

export const ADMIN_ROLES: AdminRole[] = ['owner', 'admin', 'staff'];

export function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

export function getRoleLabel(role: AdminRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Administrator';
    case 'staff':
      return 'Staff';
    default:
      return role;
  }
}

export function getRoleBadgeVariant(role: AdminRole): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'owner':
      return 'default';
    case 'admin':
      return 'secondary';
    case 'staff':
      return 'outline';
    default:
      return 'outline';
  }
}
