/**
 * Well-known permission keys. Prefer these constants over string literals.
 * Naming: `module.action` (see ADR 0002).
 */
export const Permissions = {
  PayablesRead: 'payables.read',
  PayablesCreate: 'payables.create',
  PayablesApprove: 'payables.approve',
  PayablesPay: 'payables.pay',
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];

/** All known keys (used by client bridge before RPC is available). */
export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(Permissions);
