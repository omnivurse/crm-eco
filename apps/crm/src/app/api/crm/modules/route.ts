import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

const createModuleSchema = z.object({
  org_id: z.string().uuid(),
  key: z.string().min(2).max(50),
  name: z.string().min(1).max(100),
  name_plural: z.string().max(100).optional(),
  icon: z.string().optional(),
  description: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: modules, error } = await supabase
      .from('crm_modules')
      .select('*')
      .eq('org_id', profile.organization_id)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(modules || []);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createModuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    if (profile.crm_role !== 'crm_admin') {
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
