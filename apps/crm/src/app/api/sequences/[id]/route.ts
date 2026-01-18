import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { UpdateSequenceRequest } from '@/lib/sequences/types';

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

// GET /api/sequences/[id] - Get sequence with steps
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

    const { data: sequence, error } = await supabase
      .from('email_sequences')
      .select(`
        *,
        steps:email_sequence_steps(*),
        created_by_profile:profiles!email_sequences_created_by_fkey(full_name, avatar_url)
      `)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (error || !sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Sort steps by order
    if (sequence.steps) {
      sequence.steps.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order);
    }

    // Get enrollment stats
    const { data: stats } = await supabase
      .from('email_sequence_enrollments')
      .select('status')
      .eq('sequence_id', id);

    const enrollmentStats = {
      total: stats?.length || 0,
      active: stats?.filter(e => e.status === 'active').length || 0,
      completed: stats?.filter(e => e.status === 'completed').length || 0,
      exited: stats?.filter(e => e.status === 'exited').length || 0,
      paused: stats?.filter(e => e.status === 'paused').length || 0,
    };

    return NextResponse.json({
      sequence,
      stats: enrollmentStats,
    });
  } catch (error) {
    console.error('Error fetching sequence:', error);
    return NextResponse.json({ error: 'Failed to fetch sequence' }, { status: 500 });
  }
}

// PATCH /api/sequences/[id] - Update sequence
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body: UpdateSequenceRequest = await request.json();

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

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.trigger_type !== undefined) updateData.trigger_type = body.trigger_type;
    if (body.trigger_config !== undefined) updateData.trigger_config = body.trigger_config;
    if (body.exit_conditions !== undefined) updateData.exit_conditions = body.exit_conditions;
    if (body.settings !== undefined) updateData.settings = body.settings;

    const { data: sequence, error } = await supabase
      .from('email_sequences')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(sequence);
  } catch (error) {
    console.error('Error updating sequence:', error);
    return NextResponse.json({ error: 'Failed to update sequence' }, { status: 500 });
  }
}

// DELETE /api/sequences/[id] - Delete sequence
export async function DELETE(
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

    // Check for active enrollments
    const { data: activeEnrollments } = await supabase
      .from('email_sequence_enrollments')
      .select('id')
      .eq('sequence_id', id)
      .eq('status', 'active')
      .limit(1);

    if (activeEnrollments && activeEnrollments.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete sequence with active enrollments. Pause or complete them first.'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('email_sequences')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sequence:', error);
    return NextResponse.json({ error: 'Failed to delete sequence' }, { status: 500 });
  }
}
