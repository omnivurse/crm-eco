import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { customFieldRequestSchema } from '@olyron/migrate-contract';
import { verifyOlyronMigrateRequest } from '@/lib/olyron-migrate-verify';

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const v = verifyOlyronMigrateRequest(request, raw);
  if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = customFieldRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: mod } = await admin
    .from('crm_modules')
    .select('id')
    .eq('org_id', parsed.data.orgId)
    .eq('key', 'contacts')
    .maybeSingle();
  if (!mod?.id) return NextResponse.json({ error: 'module_not_found' }, { status: 400 });

  const { data: existing } = await admin
    .from('crm_fields')
    .select('id')
    .eq('org_id', parsed.data.orgId)
    .eq('module_id', mod.id)
    .eq('key', parsed.data.key)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ fieldKey: parsed.data.key, created: false });
  }

  const typeMap: Record<string, string> = {
    string: 'text',
    text: 'textarea',
    number: 'number',
    boolean: 'boolean',
    date: 'date',
    datetime: 'datetime',
    email: 'email',
    phone: 'phone',
    url: 'url',
    enum: 'select',
  };
  const crmType = typeMap[parsed.data.type] ?? 'text';

  const { error } = await admin.from('crm_fields').insert({
    org_id: parsed.data.orgId,
    module_id: mod.id,
    key: parsed.data.key,
    label: parsed.data.label,
    type: crmType,
    required: false,
    is_system: false,
    display_order: 999,
    section: 'Migration',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fieldKey: parsed.data.key, created: true });
}
