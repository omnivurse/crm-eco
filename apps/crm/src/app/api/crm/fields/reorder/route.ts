import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

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
          } catch { }
        },
      },
    }
  );
}

const reorderSchema = z.object({
  fields: z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number().int().positive(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update all fields in a transaction-like manner
    const updatePromises = parsed.data.fields.map(({ id, display_order }) =>
      supabase
        .from('crm_fields')
        .update({ display_order })
        .eq('id', id)
        .eq('org_id', profile.organization_id)
    );

    const results = await Promise.all(updatePromises);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Reorder errors:', errors);
      return NextResponse.json({ error: 'Some updates failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: parsed.data.fields.length });
  } catch (error) {
    console.error('Reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
