import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';
import { withIdempotency } from '@/lib/server/idempotency';

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

    // Read the raw body once so the idempotency wrapper can hash it
    // and the handler closure can still parse the JSON. A replayed
    // request with a missing body still has `rawBody === ''`, which
    // hashes deterministically.
    const rawBody = await request.text();

    const { response } = await withIdempotency(
      {
        organizationId: profile.organization_id,
        method: 'POST',
        path: '/api/crm/notes',
        rawBody,
      },
      request,
      async () => {
        let body: unknown;
        try {
          body = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: 400 },
          );
        }
        const parsed = createNoteSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.errors },
            { status: 400 },
          );
        }

        const supabase = await createCrmClient();

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
      },
    );

    return response;
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
