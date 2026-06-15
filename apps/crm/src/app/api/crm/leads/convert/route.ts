import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { ensureCrmMemberRecordFromLead } from '@/lib/crm/lead-conversion-sync';
import { tryCreateLeadConversionAdminClient } from '@/lib/crm/lead-conversion-admin-client';

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

    const { data, error } = await supabase.rpc('convert_lead_to_member', {
      p_lead_record_id: recordId,
      p_user_id: profile.id,
    });

    if (error) {
      console.error('Lead conversion error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const result = data as {
      success?: boolean;
      member_id?: string;
      error?: string;
      crm_member_record_id?: string;
    };

    if (result?.success && result.member_id) {
      const adminClient = tryCreateLeadConversionAdminClient();
      const crmMember = await ensureCrmMemberRecordFromLead(adminClient ?? supabase, {
        orgId: profile.organization_id,
        leadRecordId: recordId,
        enrollmentMemberId: result.member_id,
        userId: profile.id,
      });
      if (!crmMember.ok) {
        console.warn('Lead→member enrollment succeeded but CRM member record failed:', crmMember.error);
        result.error = result.error ?? crmMember.error;
      } else if (crmMember.crmMemberRecordId) {
        result.crm_member_record_id = crmMember.crmMemberRecordId;
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Lead conversion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
