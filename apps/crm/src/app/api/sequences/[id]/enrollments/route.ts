import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { EnrollRequest } from '@/lib/sequences/types';

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

// GET /api/sequences/[id]/enrollments - List enrollments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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

    let query = supabase
      .from('email_sequence_enrollments')
      .select(`
        *,
        record:crm_records(id, title, data),
        current_step:email_sequence_steps(id, name, step_type, step_order)
      `, { count: 'exact' })
      .eq('sequence_id', id)
      .order('enrolled_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: enrollments, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      enrollments: enrollments || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}

// POST /api/sequences/[id]/enrollments - Enroll records
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body: EnrollRequest = await request.json();

    if (!body.record_ids || body.record_ids.length === 0) {
      return NextResponse.json({ error: 'record_ids is required' }, { status: 400 });
    }

    if (!body.module_key) {
      return NextResponse.json({ error: 'module_key is required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify sequence belongs to org and is active
    const { data: sequence } = await supabase
      .from('email_sequences')
      .select('id, status')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    if (sequence.status !== 'active') {
      return NextResponse.json({
        error: 'Sequence must be active to enroll records'
      }, { status: 400 });
    }

    // Get the first step
    const { data: firstStep } = await supabase
      .from('email_sequence_steps')
      .select('id, step_order, delay_days, delay_hours, delay_minutes')
      .eq('sequence_id', id)
      .order('step_order', { ascending: true })
      .limit(1)
      .single();

    if (!firstStep) {
      return NextResponse.json({
        error: 'Sequence has no steps'
      }, { status: 400 });
    }

    // Get records with email
    const { data: records } = await supabase
      .from('crm_records')
      .select('id, email, data')
      .in('id', body.record_ids)
      .eq('org_id', profile.organization_id);

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No valid records found' }, { status: 400 });
    }

    // Calculate first step time
    const calculateNextStepTime = (delayDays: number, delayHours: number, delayMinutes: number) => {
      const now = new Date();
      now.setDate(now.getDate() + delayDays);
      now.setHours(now.getHours() + delayHours);
      now.setMinutes(now.getMinutes() + delayMinutes);
      return now.toISOString();
    };

    // Enroll records
    const enrollments = [];
    const errors = [];

    for (const record of records) {
      const email = record.email || record.data?.email;

      if (!email) {
        errors.push({ record_id: record.id, error: 'No email address' });
        continue;
      }

      // Check if already enrolled
      const { data: existing } = await supabase
        .from('email_sequence_enrollments')
        .select('id')
        .eq('sequence_id', id)
        .eq('record_id', record.id)
        .single();

      if (existing) {
        errors.push({ record_id: record.id, error: 'Already enrolled' });
        continue;
      }

      const nextStepAt = calculateNextStepTime(
        firstStep.delay_days,
        firstStep.delay_hours,
        firstStep.delay_minutes
      );

      const { data: enrollment, error } = await supabase
        .from('email_sequence_enrollments')
        .insert({
          sequence_id: id,
          record_id: record.id,
          module_key: body.module_key,
          email: email as string,
          current_step_id: firstStep.id,
          current_step_order: firstStep.step_order,
          status: 'active',
          enrolled_by: profile.id,
          next_step_at: nextStepAt,
        })
        .select()
        .single();

      if (error) {
        errors.push({ record_id: record.id, error: error.message });
      } else {
        enrollments.push(enrollment);
      }
    }

    // Update sequence stats
    await supabase
      .from('email_sequences')
      .update({
        total_enrolled: supabase.rpc('increment', { x: enrollments.length }) as unknown as number,
      })
      .eq('id', id);

    return NextResponse.json({
      enrolled: enrollments.length,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error('Error enrolling records:', error);
    return NextResponse.json({ error: 'Failed to enroll records' }, { status: 500 });
  }
}

// PATCH /api/sequences/[id]/enrollments - Bulk update enrollments
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { enrollment_ids, action } = body as {
      enrollment_ids: string[];
      action: 'pause' | 'resume' | 'exit';
    };

    if (!enrollment_ids || enrollment_ids.length === 0) {
      return NextResponse.json({ error: 'enrollment_ids is required' }, { status: 400 });
    }

    if (!['pause', 'resume', 'exit'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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

    const updateData: Record<string, unknown> = {};

    if (action === 'pause') {
      updateData.status = 'paused';
    } else if (action === 'resume') {
      updateData.status = 'active';
      updateData.next_step_at = new Date().toISOString();
    } else if (action === 'exit') {
      updateData.status = 'exited';
      updateData.exit_reason = 'Manual exit';
      updateData.exited_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('email_sequence_enrollments')
      .update(updateData)
      .in('id', enrollment_ids)
      .eq('sequence_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating enrollments:', error);
    return NextResponse.json({ error: 'Failed to update enrollments' }, { status: 500 });
  }
}
