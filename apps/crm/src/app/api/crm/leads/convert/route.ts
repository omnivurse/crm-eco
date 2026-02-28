import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

// Create admin client for conversion (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for lead conversion');
  }
  
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { recordId } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'Record ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to convert leads' },
        { status: 403 }
      );
    }

    // Verify the record belongs to the user's org before using admin client
    const { data: recordCheck } = await supabase
      .from('crm_records')
      .select('id')
      .eq('id', recordId)
      .eq('org_id', profile.organization_id)
      .single();

    if (!recordCheck) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    // Use admin client to perform conversion
    const adminClient = createAdminClient();

    // Call the conversion function
    const { data, error } = await adminClient.rpc('convert_lead_to_member', {
      p_lead_record_id: recordId,
      p_user_id: profile.user_id,
    });

    if (error) {
      console.error('Lead conversion error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // The function returns jsonb with success, member_id, etc.
    return NextResponse.json(data);

  } catch (error) {
    console.error('Lead conversion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
