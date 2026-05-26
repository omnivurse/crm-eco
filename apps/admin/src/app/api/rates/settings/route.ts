import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireAdminRole } from '@/lib/auth';
import { getActiveTenant } from '@/lib/tenant';
import { getAdminProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rates/settings
 * Returns the current active_rate_set setting.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const { profile, error: authError } = await requireAdminRole(supabase);
    if (authError) return authError;

    const { data: setting } = await (supabase as any)
      .from('system_settings')
      .select('setting_value, last_changed_at, last_changed_by')
      .eq('organization_id', profile.organization_id)
      .eq('setting_key', 'active_rate_set')
      .single();

    return NextResponse.json({
      active_rate_set: setting?.setting_value || null,
      last_changed_at: setting?.last_changed_at || null,
      last_changed_by: setting?.last_changed_by || null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rates/settings
 * Update the active_rate_set setting. Writes an audit log entry.
 * Body: { active_rate_set: "current" | "rates_2026" | null }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenant = await getActiveTenant();
    if (!tenant || !['owner', 'admin'].includes(tenant.role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 });
    }
    const profile = await getAdminProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const newValue = body.active_rate_set;

    if (newValue !== null && newValue !== 'current' && newValue !== 'rates_2026') {
      return NextResponse.json(
        { error: 'active_rate_set must be "current", "rates_2026", or null' },
        { status: 400 }
      );
    }

    // Get current value for audit
    const { data: currentSetting } = await (supabase as any)
      .from('system_settings')
      .select('setting_value')
      .eq('organization_id', tenant.organizationId)
      .eq('setting_key', 'active_rate_set')
      .single();

    const oldValue = currentSetting?.setting_value || null;

    // Update setting
    const { error: updateErr } = await (supabase as any)
      .from('system_settings')
      .update({
        setting_value: newValue,
        last_changed_by: user.id,
        last_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', tenant.organizationId)
      .eq('setting_key', 'active_rate_set');

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Write audit log (requires service role — audit table is not writable by authenticated users)
    // Column map vs legacy aliases:
    //   entity_type/entity_id → target_entity_type/target_entity_id
    //   metadata              → details (jsonb)
    //   actor_name            → stored inside details (no dedicated column)
    const serviceClient = createServiceRoleClient();
    await (serviceClient as any).from('unified_audit_logs').insert({
      organization_id: tenant.organizationId,
      actor_id: user.id,
      actor_email: user.email,
      action: 'rate_set_override_changed',
      action_category: 'configuration',
      app_source: 'admin',
      risk_level: 'medium',
      target_entity_type: 'system_setting',
      target_entity_id: 'active_rate_set',
      description: `Active rate set changed from "${oldValue || 'auto'}" to "${newValue || 'auto'}"`,
      details: {
        actor_name: profile.full_name,
        old_value: oldValue,
        new_value: newValue,
      },
    });

    return NextResponse.json({
      ok: true,
      active_rate_set: newValue,
      changed_from: oldValue,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
