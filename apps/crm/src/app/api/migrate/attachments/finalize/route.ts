import { NextRequest, NextResponse } from 'next/server';
import { attachmentFinalizeRequestSchema } from '@olyron/migrate-contract';
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

  const parsed = attachmentFinalizeRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  return NextResponse.json({ ok: true, attachmentId: crypto.randomUUID() });
}
