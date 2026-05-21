import { NextResponse } from 'next/server';
import { getActiveBillingSchedule } from '@/lib/data/billing';

export const dynamic = 'force-dynamic';

export async function GET() {
  const schedule = await getActiveBillingSchedule();
  return NextResponse.json({ schedule });
}
