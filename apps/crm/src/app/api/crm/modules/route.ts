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
        setAll(cookiesToSet) {
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

const createModuleSchema = z.object({
  org_id: z.string().uuid(),
  key: z.string().min(2).max(50),
  name: z.string().min(1).max(100),
  name_plural: z.string().max(100).optional(),
  icon: z.string().optional(),
  description: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createModuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: module, error } = await supabase
      .from('crm_modules')
      .insert({
        org_id: parsed.data.org_id,
        key: parsed.data.key.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: parsed.data.name,
        name_plural: parsed.data.name_plural || parsed.data.name + 's',
        icon: parsed.data.icon || 'file',
        description: parsed.data.description,
        is_system: false,
        is_enabled: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(module);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
