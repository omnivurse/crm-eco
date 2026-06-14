import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getAuthProfile } from '@/lib/supabase-server';

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for lead conversion');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { recordId, mergeIntoContactId } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'Record ID is required' },
        { status: 400 },
      );
    }

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to convert leads' },
        { status: 403 },
      );
    }

    const adminClient = createAdminClient();

    const { data, error } = await adminClient.rpc('convert_lead_to_contact', {
      p_lead_record_id: recordId,
      p_user_id: profile.id,
      p_merge_into_contact_id: mergeIntoContactId || null,
    });

    if (error) {
      console.error('Lead to contact conversion error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    const result = data as {
      success?: boolean;
      contact_id?: string;
      error?: string;
      insurance_repair?: Record<string, unknown>;
      insurance_repair_failed?: boolean;
      insurance_repair_error?: string;
    };

    // Belt-and-suspenders: copy any insurance / health-sharing keys the RPC may have missed.
    if (result?.success && result.contact_id) {
      const { data: repairData, error: repairError } = await adminClient.rpc(
        'repair_converted_contact_insurance_data',
        { p_contact_id: result.contact_id },
      );

      if (repairError) {
        console.warn(
          'Lead conversion succeeded but insurance repair failed:',
          repairError.message,
        );
        result.insurance_repair_failed = true;
        result.insurance_repair_error = repairError.message;
      } else if (repairData && typeof repairData === 'object') {
        result.insurance_repair = repairData as Record<string, unknown>;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Lead to contact conversion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
