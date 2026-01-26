import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';

const preferencesSchema = z.object({
  module_key: z.string(),
  preferences: z.object({
    viewId: z.string().nullable(),
    columns: z.array(z.string()),
    density: z.enum(['compact', 'default', 'comfortable']),
    sortField: z.string().nullable(),
    sortDirection: z.enum(['asc', 'desc']),
  }),
});

/**
 * GET /api/crm/preferences
 * Get all user view preferences
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createCrmClient();

    const { data, error } = await supabase
      .from('crm_user_preferences')
      .select('module_key, preferences')
      .eq('user_id', profile.id)
      .eq('org_id', profile.organization_id);

    if (error) {
      // Table might not exist yet - return empty preferences
      if (error.code === '42P01') {
        return NextResponse.json({});
      }
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert array to object keyed by module_key
    const preferencesMap = (data || []).reduce((acc, item) => {
      acc[item.module_key] = item.preferences;
      return acc;
    }, {} as Record<string, unknown>);

    return NextResponse.json(preferencesMap);
  } catch (error) {
    console.error('Error in GET /api/crm/preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

/**
 * POST /api/crm/preferences
 * Save user view preferences for a module
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = preferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createCrmClient();

    const { error } = await supabase
      .from('crm_user_preferences')
      .upsert(
        {
          user_id: profile.id,
          org_id: profile.organization_id,
          module_key: parsed.data.module_key,
          preferences: parsed.data.preferences,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,org_id,module_key',
        }
      );

    if (error) {
      // Table might not exist yet - that's ok, localStorage backup will work
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, stored: 'localStorage' });
      }
      console.error('Error saving preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/crm/preferences:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
