import { NextRequest, NextResponse } from 'next/server';
import { listTransactions } from '@/lib/data/billing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  const statusFilter = url.searchParams.get('status') ?? undefined;

  const { rows, total } = await listTransactions({ limit, offset, statusFilter });
  return NextResponse.json({ transactions: rows, total, limit, offset });
}
