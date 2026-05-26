import { NextResponse } from 'next/server';

/** PHASE 2A — DEFERRED FEATURE: Pipeline stages. See parent route comment. */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ stages: [] });
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
