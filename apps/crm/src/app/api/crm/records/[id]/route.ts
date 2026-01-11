import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { executeMatchingWorkflows, applyScoring } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the previous record state for change detection
    const { data: previousRecord } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', id)
      .single();

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.data !== undefined) updates.data = body.data;
    if (body.owner_id !== undefined) updates.owner_id = body.owner_id;
    if (body.status !== undefined) updates.status = body.status;
    if (body.stage !== undefined) updates.stage = body.stage;
    if (body.title !== undefined) updates.title = body.title;

    const { data: record, error } = await supabase
      .from('crm_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedRecord = record as CrmRecord;

    // Execute on_update workflows (fire and forget for faster response)
    if (previousRecord) {
      executeMatchingWorkflows({
        orgId: typedRecord.org_id,
        moduleId: typedRecord.module_id,
        record: typedRecord,
        trigger: 'on_update',
        previousRecord: previousRecord as CrmRecord,
        dryRun: false,
        userId: user.id,
        profileId: profile.id,
      }).catch(err => {
        console.error('Workflow execution error:', err);
      });
    }

    // Apply scoring rules
    applyScoring(typedRecord, {
      orgId: typedRecord.org_id,
      moduleId: typedRecord.module_id,
      record: typedRecord,
      trigger: 'on_update',
      dryRun: false,
    }).catch(err => {
      console.error('Scoring error:', err);
    });

    return NextResponse.json(record);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('crm_records')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
