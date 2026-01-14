import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { executeMacro, canExecuteMacro } from '@/lib/automation';

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
          } catch {}
        },
      },
    }
  );
}

const runMacroSchema = z.object({
  recordId: z.string().uuid(),
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/automation/macros/[id]/run
 * Execute a macro against a record
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: macroId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if user can execute this macro
    const { allowed, reason } = await canExecuteMacro(macroId, profile.id);
    if (!allowed) {
      return NextResponse.json({ error: reason || 'Not allowed' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = runMacroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const result = await executeMacro({
      macroId,
      recordId: parsed.data.recordId,
      userId: user.id,
      profileId: profile.id,
      dryRun: parsed.data.dryRun,
    });

    return NextResponse.json({
      success: result.status !== 'failed',
      ...result,
    });
  } catch (error) {
    console.error('Failed to execute macro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
