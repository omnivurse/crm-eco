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

/**
 * GET /api/crm/records
 * Fetch records with pagination, filtering, and search
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const moduleKey = searchParams.get('module_key');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '25', 10), 100);
    const search = searchParams.get('search');

    if (!moduleKey) {
      return NextResponse.json({ error: 'module_key is required' }, { status: 400 });
    }

    // Fetch profile and module in parallel (both depend only on user.id/moduleKey)
    const [profileResult, moduleResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, organization_id, crm_role')
        .eq('user_id', user.id)
        .single(),
      // Note: We fetch module by key without org_id filter first,
      // then validate org_id after profile is available
      supabase
        .from('crm_modules')
        .select('id, org_id')
        .eq('key', moduleKey)
        .single(),
    ]);

    const { data: profile } = profileResult;
    const { data: module, error: moduleError } = moduleResult;

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Validate module belongs to user's organization
    if (moduleError || !module || module.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('crm_records')
      .select('*', { count: 'exact' })
      .eq('module_id', module.id)
      .eq('org_id', profile.organization_id);

    // Apply search if provided
    if (search) {
      query = query.or(`title.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: records, count, error } = await query;

    if (error) {
      console.error('Error fetching records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      records: records || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    console.error('Error in GET /api/crm/records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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

    // Parse body and get auth in parallel
    const [body, authResult] = await Promise.all([
      request.json(),
      supabase.auth.getUser(),
    ]);

    const { data: { user } } = authResult;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = createRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Fetch profile (needed for role check and owner_id fallback)
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
