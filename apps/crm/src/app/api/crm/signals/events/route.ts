import { NextResponse } from 'next/server';

/** PHASE 2A — DEFERRED FEATURE: Signal events. See parent route comment. */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ events: [], total: 0 });
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
