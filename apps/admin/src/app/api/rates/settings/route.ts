import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rates/settings
 * Returns the current active_rate_set setting.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string } | null };

    if (!profile) {
      return NextResponse.json({ error: 'No profile' }, { status: 403 });
    }

    const { data: setting } = await supabase
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
      { error: err instanceof Error ? err.message : 'Internal error' },
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role, display_name')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string; role: string | null; display_name: string | null } | null };

    if (!profile || !['owner', 'admin'].includes(profile.role || '')) {
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
    const { data: currentSetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('organization_id', profile.organization_id)
      .eq('setting_key', 'active_rate_set')
      .single();

    const oldValue = currentSetting?.setting_value || null;

    // Update setting
    const { error: updateErr } = await supabase
      .from('system_settings')
      .update({
        setting_value: newValue,
        last_changed_by: user.id,
        last_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', profile.organization_id)
      .eq('setting_key', 'active_rate_set');

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Write audit log
    await supabase.from('unified_audit_logs').insert({
      organization_id: profile.organization_id,
      actor_id: user.id,
      actor_email: user.email,
      actor_name: profile.display_name,
      action: 'rate_set_override_changed',
      action_category: 'configuration',
      app_source: 'admin',
      risk_level: 'medium',
      entity_type: 'system_setting',
      entity_id: 'active_rate_set',
      description: `Active rate set changed from "${oldValue || 'auto'}" to "${newValue || 'auto'}"`,
      metadata: {
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
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
