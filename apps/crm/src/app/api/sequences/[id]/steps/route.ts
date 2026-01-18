import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CreateStepRequest } from '@/lib/sequences/types';

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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// GET /api/sequences/[id]/steps - List steps
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify sequence belongs to org
    const { data: sequence } = await supabase
      .from('email_sequences')
      .select('id')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const { data: steps, error } = await supabase
      .from('email_sequence_steps')
      .select('*')
      .eq('sequence_id', id)
      .order('step_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ steps: steps || [] });
  } catch (error) {
    console.error('Error fetching steps:', error);
    return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 });
  }
}

// POST /api/sequences/[id]/steps - Create step
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body: CreateStepRequest = await request.json();

    if (!body.step_type) {
      return NextResponse.json({ error: 'Step type is required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify sequence belongs to org and is not active
    const { data: sequence } = await supabase
      .from('email_sequences')
      .select('id, status')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Get max step order
    const { data: existingSteps } = await supabase
      .from('email_sequence_steps')
      .select('step_order')
      .eq('sequence_id', id)
      .order('step_order', { ascending: false })
      .limit(1);

    const maxOrder = existingSteps?.[0]?.step_order ?? -1;
    const stepOrder = body.step_order ?? maxOrder + 1;

    // If inserting at specific position, shift other steps
    if (body.step_order !== undefined && body.step_order <= maxOrder) {
      await supabase.rpc('shift_sequence_steps', {
        p_sequence_id: id,
        p_from_order: body.step_order,
      });
    }

    const { data: step, error } = await supabase
      .from('email_sequence_steps')
      .insert({
        sequence_id: id,
        step_order: stepOrder,
        step_type: body.step_type,
        name: body.name || null,
        delay_days: body.delay_days || 0,
        delay_hours: body.delay_hours || 0,
        delay_minutes: body.delay_minutes || 0,
        send_time: body.send_time || null,
        send_days: body.send_days || [],
        template_id: body.template_id || null,
        subject: body.subject || null,
        body_html: body.body_html || null,
        body_text: body.body_text || null,
        from_name: body.from_name || null,
        from_email: body.from_email || null,
        condition_config: body.condition_config || null,
        action_config: body.action_config || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    console.error('Error creating step:', error);
    return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
  }
}

// PUT /api/sequences/[id]/steps - Reorder steps
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { step_ids } = body as { step_ids: string[] };

    if (!step_ids || !Array.isArray(step_ids)) {
      return NextResponse.json({ error: 'step_ids array is required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify sequence belongs to org
    const { data: sequence } = await supabase
      .from('email_sequences')
      .select('id')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Update step orders
    for (let i = 0; i < step_ids.length; i++) {
      await supabase
        .from('email_sequence_steps')
        .update({ step_order: i })
        .eq('id', step_ids[i])
        .eq('sequence_id', id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering steps:', error);
    return NextResponse.json({ error: 'Failed to reorder steps' }, { status: 500 });
  }
}
