import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/crm/records/check-duplicate?module_key=contacts&email=foo@bar.com&phone=555-1234
 *
 * Check for existing records that match the given email or phone.
 * Returns matching duplicates so the UI can warn before creating.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const moduleKey = searchParams.get('module_key');
    const email = searchParams.get('email')?.trim() || null;
    const phone = searchParams.get('phone')?.trim() || null;
    const excludeId = searchParams.get('exclude_id') || null;

    if (!moduleKey) {
      return NextResponse.json({ error: 'module_key is required' }, { status: 400 });
    }

    if (!email && !phone) {
      return NextResponse.json({ duplicates: [], hasDuplicates: false });
    }

    // Look up module
    const { data: mod, error: moduleError } = await supabase
      .from('crm_modules')
      .select('id, org_id')
      .eq('key', moduleKey)
      .single();

    if (moduleError || !mod || mod.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const { data: duplicates, error } = await (supabase as any).rpc('check_crm_duplicate', {
      p_org_id: profile.organization_id,
      p_module_id: mod.id,
      p_email: email,
      p_phone: phone,
      p_exclude_id: excludeId,
    });

    if (error) {
      console.error('Duplicate check error:', error);
      return NextResponse.json({ duplicates: [], hasDuplicates: false });
    }

    return NextResponse.json({
      duplicates: duplicates || [],
      hasDuplicates: (duplicates?.length || 0) > 0,
    });
  } catch (error) {
    console.error('Error in GET /api/crm/records/check-duplicate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
