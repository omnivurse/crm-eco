import { orgRoleImpliesPermission, permissionsFromOrgRole } from './org-role-bridge';
import { ALL_PERMISSION_KEYS, type PermissionKey } from './keys';

/** Minimal supabase surface for permission RPCs. */
export type PermissionsClient = {
  auth: {
    getUser: () => PromiseLike<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export type PermissionDenied = {
  ok: false;
  status: 401 | 403;
  error: string;
};

export type PermissionGranted = {
  ok: true;
  userId: string;
};

function isMissingRpc(error: { message: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

/**
 * Boolean check: does the current user hold `permissionKey` in `organizationId`?
 * Falls back to the org-role bridge if the RPC is not deployed yet.
 */
export async function hasPermission(
  supabase: PermissionsClient,
  organizationId: string,
  permissionKey: string,
  options?: { fallbackRole?: string | null },
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_org_permission', {
    p_org_id: organizationId,
    p_permission_key: permissionKey,
  });

  if (!error) {
    return data === true;
  }

  if (isMissingRpc(error) && options?.fallbackRole !== undefined) {
    return orgRoleImpliesPermission(options.fallbackRole, permissionKey);
  }

  // Fail closed when RPC errors for other reasons
  if (isMissingRpc(error)) {
    return false;
  }

  console.error('[permissions] has_org_permission failed:', error.message);
  return false;
}

/**
 * All permission keys for the current user in an org (client bootstrap).
 * Falls back to bridge keys when RPC is missing.
 */
export async function listPermissions(
  supabase: PermissionsClient,
  organizationId: string,
  options?: { fallbackRole?: string | null },
): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_org_permissions', {
    p_org_id: organizationId,
  });

  if (!error && Array.isArray(data)) {
    return data.filter((k): k is string => typeof k === 'string');
  }

  if (isMissingRpc(error) && options?.fallbackRole !== undefined) {
    return permissionsFromOrgRole(options.fallbackRole);
  }

  if (error && !isMissingRpc(error)) {
    console.error('[permissions] list_org_permissions failed:', error.message);
  }

  // Fail closed unless bridge role provided
  return options?.fallbackRole !== undefined
    ? permissionsFromOrgRole(options.fallbackRole)
    : [];
}

/**
 * Gate helper for API routes. Does not import Next.js — map to NextResponse in the app.
 */
export async function requirePermission(
  supabase: PermissionsClient,
  organizationId: string,
  permissionKey: string,
  options?: { fallbackRole?: string | null },
): Promise<PermissionGranted | PermissionDenied> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const allowed = await hasPermission(supabase, organizationId, permissionKey, options);
  if (!allowed) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, userId: user.id };
}

/** Type guard helper for known keys. */
export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSION_KEYS as string[]).includes(value);
}
