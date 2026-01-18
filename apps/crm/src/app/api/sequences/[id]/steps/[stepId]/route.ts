import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

// GET /api/sequences/[id]/steps/[stepId] - Get single step
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id, stepId } = await params;

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

    const { data: step, error } = await supabase
      .from('email_sequence_steps')
      .select('*')
      .eq('id', stepId)
      .eq('sequence_id', id)
      .single();

    if (error || !step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    return NextResponse.json(step);
  } catch (error) {
    console.error('Error fetching step:', error);
    return NextResponse.json({ error: 'Failed to fetch step' }, { status: 500 });
  }
}

// PATCH /api/sequences/[id]/steps/[stepId] - Update step
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id, stepId } = await params;
    const body = await request.json();

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

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.step_type !== undefined) updateData.step_type = body.step_type;
    if (body.delay_days !== undefined) updateData.delay_days = body.delay_days;
    if (body.delay_hours !== undefined) updateData.delay_hours = body.delay_hours;
    if (body.delay_minutes !== undefined) updateData.delay_minutes = body.delay_minutes;
    if (body.send_time !== undefined) updateData.send_time = body.send_time || null;
    if (body.send_days !== undefined) updateData.send_days = body.send_days;
    if (body.template_id !== undefined) updateData.template_id = body.template_id || null;
    if (body.subject !== undefined) updateData.subject = body.subject || null;
    if (body.body_html !== undefined) updateData.body_html = body.body_html || null;
    if (body.body_text !== undefined) updateData.body_text = body.body_text || null;
    if (body.from_name !== undefined) updateData.from_name = body.from_name || null;
    if (body.from_email !== undefined) updateData.from_email = body.from_email || null;
    if (body.condition_config !== undefined) updateData.condition_config = body.condition_config;
    if (body.action_config !== undefined) updateData.action_config = body.action_config;

    const { data: step, error } = await supabase
      .from('email_sequence_steps')
      .update(updateData)
      .eq('id', stepId)
      .eq('sequence_id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(step);
  } catch (error) {
    console.error('Error updating step:', error);
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
  }
}

// DELETE /api/sequences/[id]/steps/[stepId] - Delete step
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id, stepId } = await params;

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
      .select('id, status')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Get the step to find its order
    const { data: stepToDelete } = await supabase
      .from('email_sequence_steps')
      .select('step_order')
      .eq('id', stepId)
      .eq('sequence_id', id)
      .single();

    if (!stepToDelete) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    // Delete the step
    const { error } = await supabase
      .from('email_sequence_steps')
      .delete()
      .eq('id', stepId)
      .eq('sequence_id', id);

    if (error) throw error;

    // Reorder remaining steps
    const { data: remainingSteps } = await supabase
      .from('email_sequence_steps')
      .select('id, step_order')
      .eq('sequence_id', id)
      .gt('step_order', stepToDelete.step_order)
      .order('step_order', { ascending: true });

    if (remainingSteps) {
      for (const step of remainingSteps) {
        await supabase
          .from('email_sequence_steps')
          .update({ step_order: step.step_order - 1 })
          .eq('id', step.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting step:', error);
    return NextResponse.json({ error: 'Failed to delete step' }, { status: 500 });
  }
}
