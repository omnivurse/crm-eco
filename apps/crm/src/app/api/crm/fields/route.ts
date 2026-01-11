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

const createFieldSchema = z.object({
  org_id: z.string().uuid(),
  module_id: z.string().uuid(),
  key: z.string().min(2).max(50),
  label: z.string().min(1).max(100),
  type: z.string(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  validation: z.record(z.unknown()).optional(),
  default_value: z.string().optional(),
  tooltip: z.string().max(500).optional(),
  section: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createFieldSchema.safeParse(body);

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

    // Get max display_order
    const { data: existing } = await supabase
      .from('crm_fields')
      .select('display_order')
      .eq('module_id', parsed.data.module_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = existing?.[0]?.display_order || 0;

    const { data: field, error } = await supabase
      .from('crm_fields')
      .insert({
        org_id: parsed.data.org_id,
        module_id: parsed.data.module_id,
        key: parsed.data.key.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        label: parsed.data.label,
        type: parsed.data.type,
        required: parsed.data.required || false,
        is_system: false,
        options: parsed.data.options || [],
        validation: parsed.data.validation || {},
        default_value: parsed.data.default_value,
        tooltip: parsed.data.tooltip,
        section: parsed.data.section || 'main',
        display_order: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(field);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
