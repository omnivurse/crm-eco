import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import type { CrmRole } from '@/lib/crm/types';
import { logAuditEvent, AuditActions } from '@crm-eco/lib/audit';
import { crmRoleForCatalogKey } from '@/lib/crm/catalog-role-map';
import { revokeUserSessions } from '@/lib/security/revoke-sessions';

export const dynamic = 'force-dynamic';

const assignSchema = z.object({
  /** profiles.id of the target user */
  profile_id: z.string().uuid(),
  role_id: z.string().uuid(),
  /** When true (default), sync profiles.crm_role for known system catalog keys */
  sync_crm_role: z.boolean().optional().default(true),
});

/**
 * GET /api/crm/security/user-roles?role_id= | ?profile_id=
 * List catalog role assignments for a role or a profile (org-scoped).
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roleId = request.nextUrl.searchParams.get('role_id');
    const profileId = request.nextUrl.searchParams.get('profile_id');
    if (!roleId && !profileId) {
      return NextResponse.json(
        { error: 'role_id or profile_id is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    if (roleId) {
      const { data: role } = await supabase
        .from('crm_roles')
        .select('id, organization_id')
        .eq('id', roleId)
        .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
        .maybeSingle();
      if (!role) {
        return NextResponse.json({ error: 'Role not found' }, { status: 404 });
      }

      const { data: assignments, error } = await supabase
        .from('crm_user_roles')
        .select('id, user_id, role_id, granted_by, created_at')
        .eq('role_id', roleId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const authIds = (assignments || []).map((a) => a.user_id as string);
      let members: Array<{
        id: string;
        user_id: string;
        full_name: string | null;
        email: string | null;
      }> = [];
      if (authIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, email')
          .eq('organization_id', profile.organization_id)
          .in('user_id', authIds);
        members = (profiles || []) as typeof members;
      }

      const byAuth = new Map(members.map((m) => [m.user_id, m]));
      const rows = (assignments || [])
        .map((a) => {
          const member = byAuth.get(a.user_id as string);
          if (!member) return null; // other-tenant / orphan — hide
          return {
            id: a.id,
            role_id: a.role_id,
            profile_id: member.id,
            user_id: a.user_id,
            full_name: member.full_name,
            email: member.email,
            granted_by: a.granted_by,
            created_at: a.created_at,
          };
        })
        .filter(Boolean);

      return NextResponse.json({ assignments: rows });
    }

    // profile_id path
    const { data: target } = await supabase
      .from('profiles')
      .select('id, user_id, organization_id')
      .eq('id', profileId!)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();
    if (!target?.user_id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: assignments, error } = await supabase
      .from('crm_user_roles')
      .select('id, user_id, role_id, granted_by, created_at, crm_roles(id, key, name, is_system)')
      .eq('user_id', target.user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile_id: target.id,
      assignments: assignments || [],
    });
  } catch (err) {
    console.error('[security/user-roles GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/security/user-roles
 * Assign a catalog role to an org user (writes crm_user_roles).
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = assignSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = await createClient();
    const { profile_id, role_id, sync_crm_role } = parsed.data;

    const { data: target } = await supabase
      .from('profiles')
      .select('id, user_id, organization_id, crm_role, full_name')
      .eq('id', profile_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!target?.user_id) {
      return NextResponse.json({ error: 'User not found in this organization' }, { status: 404 });
    }

    const { data: role } = await supabase
      .from('crm_roles')
      .select('id, key, name, is_system, organization_id')
      .eq('id', role_id)
      .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from('crm_user_roles')
      .select('id')
      .eq('user_id', target.user_id)
      .eq('role_id', role_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ assignment: existing, already_assigned: true });
    }

    const { data: assignment, error } = await supabase
      .from('crm_user_roles')
      .insert({
        user_id: target.user_id,
        role_id,
        granted_by: profile.id,
      })
      .select('id, user_id, role_id, granted_by, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let syncedCrmRole: CrmRole | null = null;
    const mapped = crmRoleForCatalogKey(role.key);
    if (sync_crm_role && mapped && target.id !== profile.id) {
      const { error: crmErr } = await supabase
        .from('profiles')
        .update({ crm_role: mapped, updated_at: new Date().toISOString() })
        .eq('id', target.id)
        .eq('organization_id', profile.organization_id);
      if (!crmErr) {
        syncedCrmRole = mapped;
        await revokeUserSessions(target.user_id, 'role_changed').catch(() => undefined);
        await logAuditEvent({
          appSource: 'crm',
          action: AuditActions.ROLE_CHANGED,
          actionCategory: 'authorization',
          riskLevel: 'high',
          targetEntityType: 'profile',
          targetEntityId: target.id,
          targetUserId: target.user_id ?? undefined,
          description: `Catalog role "${role.key}" assigned; CRM role synced to ${mapped}`,
          metadata: {
            source: 'catalog_role_assign',
            catalog_role_key: role.key,
            crm_role: mapped,
            previous_crm_role: target.crm_role,
          },
        }).catch(() => undefined);
      }
    }

    return NextResponse.json(
      {
        assignment,
        profile_id: target.id,
        synced_crm_role: syncedCrmRole,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[security/user-roles POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/security/user-roles?id=<assignment_id>
 * Remove a catalog role assignment. Does not clear profiles.crm_role.
 */
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing assignment id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: row } = await supabase
      .from('crm_user_roles')
      .select('id, user_id, role_id')
      .eq('id', id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Ensure the assignee belongs to this org
    const { data: member } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Assignment not in this organization' }, { status: 403 });
    }

    const { error } = await supabase.from('crm_user_roles').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[security/user-roles DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
