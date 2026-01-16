import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
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

const createRecordSchema = z.object({
  org_id: z.string().uuid(),
  module_id: z.string().uuid(),
  owner_id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  status: z.string().optional(),
  stage: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: record, error } = await supabase
      .from('crm_records')
      .insert({
        org_id: parsed.data.org_id,
        module_id: parsed.data.module_id,
        owner_id: parsed.data.owner_id || profile.id,
        data: parsed.data.data,
        status: parsed.data.status,
        stage: parsed.data.stage,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedRecord = record as CrmRecord;

    // Execute on_create workflows (fire and forget for faster response)
    executeMatchingWorkflows({
      orgId: typedRecord.org_id,
      moduleId: typedRecord.module_id,
      record: typedRecord,
      trigger: 'on_create',
      dryRun: false,
      userId: user.id,
      profileId: profile.id,
    }).catch(err => {
      console.error('Workflow execution error:', err);
    });

    // Apply scoring rules
    applyScoring(typedRecord, {
      orgId: typedRecord.org_id,
      moduleId: typedRecord.module_id,
      record: typedRecord,
      trigger: 'on_create',
      dryRun: false,
    }).catch(err => {
      console.error('Scoring error:', err);
    });

    return NextResponse.json(record);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
