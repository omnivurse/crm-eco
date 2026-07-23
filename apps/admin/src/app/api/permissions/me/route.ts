import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { listPermissions } from '@crm-eco/lib/permissions';
import { requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/permissions/me
 * Returns permission keys for the current user in the active tenant.
 * Uses list_org_permissions RPC when available; falls back to org-role bridge.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { profile, error: authError } = await requireAdminRole(supabase);
    if (authError) return authError;
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissions = await listPermissions(
      supabase as any,
      profile.organization_id,
      { fallbackRole: profile.role },
    );

    return NextResponse.json({
      organizationId: profile.organization_id,
      permissions,
    });
  } catch (err) {
    console.error('[permissions/me]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
