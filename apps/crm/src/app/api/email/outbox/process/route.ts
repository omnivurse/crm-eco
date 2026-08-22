import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { verifyCronSecret } from '@/lib/security/verify-cron-secret';
import { processEmailOutbox } from '@/lib/email/outbox-process';

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  const limit = Math.min(
    parseInt(new URL(request.url).searchParams.get('limit') || '25', 10) || 25,
    100,
  );

  try {
    const supabase = createServiceClient();
    const result = await processEmailOutbox(supabase, limit);
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[email/outbox] process failed', error);
    return NextResponse.json({ error: 'Outbox processing failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
