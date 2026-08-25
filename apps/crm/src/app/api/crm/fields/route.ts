import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { normalizeOptions } from '@/lib/crm/field-options';

const fieldOptionObjectSchema = z.object({
  id: z.string().optional(),
  value: z.string(),
  label: z.string().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createFieldSchema = z.object({
  org_id: z.string().uuid(),
  module_id: z.string().uuid(),
  key: z.string().min(2).max(50),
  label: z.string().min(1).max(100),
  type: z.string(),
  required: z.boolean().optional(),
  options: z.array(z.union([z.string(), fieldOptionObjectSchema])).optional(),
  validation: z.record(z.unknown()).optional(),
  default_value: z.string().optional(),
  tooltip: z.string().max(500).optional(),
  section: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createFieldSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (parsed.data.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Organization mismatch' }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from('crm_fields')
      .select('display_order')
      .eq('module_id', parsed.data.module_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = existing?.[0]?.display_order || 0;
    const options = normalizeOptions(parsed.data.options || []);

    const { data: field, error } = await supabase
      .from('crm_fields')
      .insert({
        org_id: profile.organization_id,
        module_id: parsed.data.module_id,
        key: parsed.data.key.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        label: parsed.data.label,
        type: parsed.data.type,
        required: parsed.data.required || false,
        is_system: false,
        options,
        validation: parsed.data.validation || {},
        default_value: parsed.data.default_value,
        tooltip: parsed.data.tooltip,
        section: parsed.data.section || 'core',
        display_order: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(field);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
