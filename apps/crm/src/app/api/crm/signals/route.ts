import { NextResponse } from 'next/server';

/**
 * PHASE 2A — DEFERRED FEATURE: CRM Signals (engagement/risk/opportunity
 * detection). The client elected to rely on `crm_workflows` triggers for
 * automation and revisit signals later. The original route and the
 * matching `crm_signals` + `crm_signal_events` tables were removed.
 * This stub returns empty data so any lingering UI bindings render
 * empty state instead of crashing.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ signals: [], total: 0 });
}

export async function POST() {
  return NextResponse.json(
    { error: 'Signals are not enabled for this tenant.' },
    { status: 501 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Signals are not enabled for this tenant.' },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Signals are not enabled for this tenant.' },
    { status: 501 }
  );
}
