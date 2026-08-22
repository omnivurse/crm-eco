import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { requireActiveOrgCrmRoles } from '@/lib/crm/require-crm-role';

// Create admin client for sync (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for sync operations');
  }
  
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

/**
 * POST /api/crm/sync
 * Backfill all members to CRM contacts
 */
/**
 * `members.status` is a LOWERCASE enum ('active', 'inactive', …) while
 * crm_records uses the capitalised CRM vocabulary. Copying it across verbatim
 * is what seeded ~1,500 lowercase 'active' rows, so map it exactly the way the
 * database already does in public.map_member_status_to_crm().
 */
const MEMBER_STATUS_TO_CRM: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  terminated: 'Terminated',
  paused: 'Inactive',
  prospect: 'Prospect',
  cancelled: 'Cancelled',
};

function crmStatusForMember(memberStatus?: string | null): string {
  const key = (memberStatus ?? '').trim().toLowerCase();
  return MEMBER_STATUS_TO_CRM[key] ?? 'Active';
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    const supabase = await createClient();
    
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json(
        { success: false, error: 'Only admins can perform sync operations' },
        { status: 403 }
      );
    }

    // Defense in depth. The check above reads the profile role, which
    // getAuthProfile now downgrades to the ACTIVE org's rights — but
    // createAdminClient() below bypasses RLS entirely, so this gate is the only
    // control on a mass record backfill. Re-assert against the database.
    const activeOrgGate = await requireActiveOrgCrmRoles(supabase, profile.organization_id, [
      'crm_admin',
    ]);
    if (!activeOrgGate.ok) {
      return NextResponse.json(
        { success: false, error: activeOrgGate.error },
        { status: activeOrgGate.status },
      );
    }

    const adminClient = createAdminClient();

    if (action === 'backfill_members') {
      // Get all members for this org that aren't already linked
      const { data: members, error: membersError } = await adminClient
        .from('members')
        .select('id, first_name, last_name, email, phone, status, organization_id')
        .eq('organization_id', profile.organization_id);

      if (membersError) {
        return NextResponse.json(
          { success: false, error: membersError.message },
          { status: 500 }
        );
      }

      // Get contacts module
      const { data: contactsModule } = await adminClient
        .from('crm_modules')
        .select('id')
        .eq('org_id', profile.organization_id)
        .eq('key', 'contacts')
        .eq('is_enabled', true)
        .single();

      if (!contactsModule) {
        return NextResponse.json(
          { success: false, error: 'Contacts module not found or not enabled' },
          { status: 404 }
        );
      }

      // Get existing linked records
      const { data: existingRecords } = await adminClient
        .from('crm_records')
        .select('data')
        .eq('module_id', contactsModule.id)
        .not('data->linked_member_id', 'is', null);

      const linkedMemberIds = new Set(
        (existingRecords || [])
          .map(r => r.data?.linked_member_id)
          .filter(Boolean)
      );

      // Filter to members not yet synced
      const membersToSync = (members || []).filter(m => !linkedMemberIds.has(m.id));

      let synced = 0;
      let errors = 0;

      for (const member of membersToSync) {
        const title = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email || 'Unknown';

        const { error: insertError } = await adminClient
          .from('crm_records')
          .insert({
            org_id: member.organization_id,
            module_id: contactsModule.id,
            title,
            email: member.email,
            phone: member.phone,
            status: crmStatusForMember(member.status),
            data: {
              first_name: member.first_name,
              last_name: member.last_name,
              email: member.email,
              phone: member.phone,
              contact_status: crmStatusForMember(member.status),
              linked_member_id: member.id,
              source: 'enrollment_backfill',
            },
          });

        if (insertError) {
          console.error(`Failed to sync member ${member.id}:`, insertError);
          errors++;
        } else {
          synced++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Synced ${synced} members to CRM contacts`,
        synced,
        errors,
        skipped: (members?.length || 0) - membersToSync.length,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crm/sync
 * Get sync status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count members
    const { count: memberCount } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id);

    // Count linked CRM contacts
    const { data: contactsModule } = await supabase
      .from('crm_modules')
      .select('id')
      .eq('org_id', profile.organization_id)
      .eq('key', 'contacts')
      .single();

    let linkedCount = 0;
    if (contactsModule) {
      const { count } = await supabase
        .from('crm_records')
        .select('*', { count: 'exact', head: true })
        .eq('module_id', contactsModule.id)
        .not('data->linked_member_id', 'is', null);
      linkedCount = count || 0;
    }

    return NextResponse.json({
      totalMembers: memberCount || 0,
      linkedContacts: linkedCount,
      unlinked: (memberCount || 0) - linkedCount,
    });

  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
