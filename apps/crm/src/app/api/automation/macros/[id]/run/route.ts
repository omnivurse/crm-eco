import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile, getAuthUser } from '@/lib/supabase-server';
import { z } from 'zod';
import { executeMacro, canExecuteMacro } from '@/lib/automation';

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
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user for userId in executeMacro
    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
