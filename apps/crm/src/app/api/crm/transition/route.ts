import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { executeTransition, getModuleBlueprint, getAvailableTransitions, validateTransition } from '@/lib/blueprints';

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

const transitionSchema = z.object({
  recordId: z.string().uuid(),
  toStage: z.string().min(1),
  reason: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

const validateSchema = z.object({
  recordId: z.string().uuid(),
  toStage: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

/**
 * POST /api/crm/transition
 * Execute a stage transition
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = transitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify record access
    const { data: record } = await supabase
      .from('crm_records')
      .select('org_id')
      .eq('id', parsed.data.recordId)
      .single();

    if (!record || record.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Execute transition
    const result = await executeTransition(parsed.data, {
      profileId: profile.id,
      userId: user.id,
      userRole: profile.crm_role || undefined,
    });

    if (!result.success && !result.requiresApproval) {
      return NextResponse.json({
        success: false,
        error: result.error,
        missingFields: result.missingFields,
        invalidTransition: result.invalidTransition,
      }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Transition error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crm/transition?recordId=xxx
 * Get available transitions for a record
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    const toStage = searchParams.get('toStage');

    if (!recordId) {
      return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get record
    const { data: record } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (!record || record.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Get blueprint
    const blueprint = await getModuleBlueprint(record.module_id);
    
    if (!blueprint) {
      return NextResponse.json({
        hasBlueprint: false,
        availableTransitions: [],
      });
    }

    // If toStage is specified, validate that specific transition
    if (toStage) {
      const validation = validateTransition(blueprint, record, toStage, {
        userRole: profile.crm_role || undefined,
      });
      
      return NextResponse.json({
        hasBlueprint: true,
        validation,
      });
    }

    // Get all available transitions
    const availableTransitions = getAvailableTransitions(
      blueprint,
      record.stage,
      profile.crm_role || undefined
    );

    return NextResponse.json({
      hasBlueprint: true,
      currentStage: record.stage,
      stages: blueprint.stages,
      availableTransitions,
    });
  } catch (error) {
    console.error('Get transitions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
