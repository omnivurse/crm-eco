import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Create admin client for sync (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for sync operations');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

/**
 * POST /api/crm/sync
 * Backfill all members to CRM contacts
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    // Get the current user from the session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component context
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile to verify permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.crm_role !== 'crm_admin') {
      return NextResponse.json(
        { success: false, error: 'Only admins can perform sync operations' },
        { status: 403 }
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
            status: member.status || 'Active',
            data: {
              first_name: member.first_name,
              last_name: member.last_name,
              email: member.email,
              phone: member.phone,
              contact_status: member.status || 'Active',
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
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component context
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
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
