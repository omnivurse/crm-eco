import { NextResponse } from 'next/server';

/**
 * PHASE 2A — DEFERRED FEATURE: CRM Pipelines (custom kanban stages per module).
 *
 * The client elected to keep existing hardcoded stages and revisit
 * customizable pipelines post-enrollment. The original route and the
 * matching `crm_pipelines` table have been removed. This stub returns
 * empty data so any lingering UI bindings render an empty state instead
 * of crashing.
 *
 * Re-enable plan: restore commit `<see git history>` and apply the
 * `crm_pipelines` migration from `supabase/migrations_temp/`.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ pipelines: [] });
}

export async function POST() {
  return NextResponse.json(
    { error: 'Pipelines are not enabled for this tenant.' },
    { status: 501 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Pipelines are not enabled for this tenant.' },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Pipelines are not enabled for this tenant.' },
    { status: 501 }
  );
}
