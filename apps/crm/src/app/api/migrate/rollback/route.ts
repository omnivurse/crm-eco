import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rollbackRequestSchema } from '@olyron/migrate-contract';
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

  const parsed = rollbackRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let deleted = 0;
  let failed = 0;
  const errors: { targetId: string; message: string }[] = [];

  for (const id of parsed.data.targetIds) {
    const { error } = await admin.from('crm_records').delete().eq('id', id).eq('org_id', parsed.data.orgId);
    if (error) {
      failed += 1;
      errors.push({ targetId: id, message: error.message });
    } else {
      deleted += 1;
    }
  }

  return NextResponse.json({ deleted, failed, errors: errors.length ? errors : undefined });
}
