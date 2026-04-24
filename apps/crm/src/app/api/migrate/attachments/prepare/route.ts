import { NextRequest, NextResponse } from 'next/server';
import { attachmentPrepareRequestSchema } from '@olyron/migrate-contract';
import { verifyOlyronMigrateRequest } from '@/lib/olyron-migrate-verify';

/** Returns a signed upload URL for CRM storage (configure bucket `crm-migrate-uploads` in Supabase). */
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

  const parsed = attachmentPrepareRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return NextResponse.json({
    uploadUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/migrate/attachments/upload-placeholder`,
    uploadMethod: 'PUT' as const,
    finalizeToken: token,
    expiresAt,
  });
}
