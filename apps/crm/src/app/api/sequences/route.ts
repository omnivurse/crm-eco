import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import type { CreateSequenceRequest } from '@/lib/sequences/types';

// GET /api/sequences - List sequences
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('email_sequences')
      .select(`
        *,
        steps:email_sequence_steps(count),
        enrollments:email_sequence_enrollments(count)
      `)
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sequences, error } = await query;

    if (error) throw error;

    return NextResponse.json({ sequences: sequences || [] });
  } catch (error) {
    console.error('Error fetching sequences:', error);
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 });
  }
}

// POST /api/sequences - Create sequence
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: CreateSequenceRequest = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: sequence, error } = await supabase
      .from('email_sequences')
      .insert({
        org_id: profile.organization_id,
        name: body.name.trim(),
        description: body.description || null,
        status: 'draft',
        trigger_type: body.trigger_type || null,
        trigger_config: body.trigger_config || {},
        exit_conditions: body.exit_conditions || [],
        settings: body.settings || {
          track_opens: true,
          track_clicks: true,
          stop_on_reply: true,
        },
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(sequence, { status: 201 });
  } catch (error) {
    console.error('Error creating sequence:', error);
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
  }
}
