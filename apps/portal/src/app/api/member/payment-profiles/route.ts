import { NextResponse } from 'next/server';
import { listPaymentProfiles } from '@/lib/data/billing';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profiles = await listPaymentProfiles();
  return NextResponse.json({ profiles });
}
