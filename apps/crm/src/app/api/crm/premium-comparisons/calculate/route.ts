import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const calculateSchema = z.object({
  full_premium: z.number().min(0),
  tax_credit: z.number().min(0).default(0),
});

/**
 * POST /api/crm/premium-comparisons/calculate
 * Stateless net premium calculation: gross - credit = net
 * Use this for quick ad-hoc calculations without saving
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = calculateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { full_premium, tax_credit } = parsed.data;
    const net_premium = Math.max(full_premium - tax_credit, 0);

    return NextResponse.json({
      gross_premium: full_premium,
      tax_credit,
      net_premium,
    });
  } catch (error) {
    console.error('[Calculate POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
