import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';

const createNoteSchema = z.object({
  record_id: z.string().uuid(),
  body: z.string().min(1),
  is_pinned: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createCrmClient();

    // Duplicate prevention: if an identical note was created in the last 60 seconds, return it instead
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: existingNote } = await supabase
      .from('crm_notes')
      .select()
      .eq('record_id', parsed.data.record_id)
      .eq('body', parsed.data.body)
      .eq('created_by', profile.id)
      .gte('created_at', sixtySecondsAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingNote) {
      return NextResponse.json(existingNote);
    }

    const { data: note, error } = await supabase
      .from('crm_notes')
      .insert({
        org_id: profile.organization_id,
        record_id: parsed.data.record_id,
        body: parsed.data.body,
        is_pinned: parsed.data.is_pinned || false,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
