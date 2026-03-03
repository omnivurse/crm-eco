import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/commissions/reversals
 *
 * Create a reversal for a ledger entry or a clawback for an advisor.
 *
 * Body (reversal):
 *   type           – 'reversal'
 *   ledgerEntryId  – the ledger entry to reverse
 *   reason         – reason for reversal
 *
 * Body (clawback):
 *   type           – 'clawback'
 *   advisorId      – advisor to clawback from
 *   amount         – positive amount to clawback
 *   reason         – reason for clawback
 *   commissionId   – optional linked commission
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createClient();

    if (body.type === 'reversal') {
      if (!body.ledgerEntryId || !body.reason) {
        return NextResponse.json(
          { error: 'ledgerEntryId and reason are required' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase.rpc('create_payout_reversal', {
        p_ledger_entry_id: body.ledgerEntryId,
        p_reason: body.reason,
        p_actor_id: profile.id,
      });

      if (error) throw error;
      if (data?.error) {
        return NextResponse.json({ error: data.error }, { status: 409 });
      }
      return NextResponse.json(data);
    }

    if (body.type === 'clawback') {
      if (!body.advisorId || !body.amount || !body.reason) {
        return NextResponse.json(
          { error: 'advisorId, amount, and reason are required' },
          { status: 400 }
        );
      }

      if (body.amount <= 0) {
        return NextResponse.json(
          { error: 'Clawback amount must be positive' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase.rpc('create_payout_clawback', {
        p_org_id: profile.organization_id,
        p_advisor_id: body.advisorId,
        p_amount: body.amount,
        p_reason: body.reason,
        p_commission_id: body.commissionId || null,
        p_actor_id: profile.id,
      });

      if (error) throw error;
      if (data?.error) {
        return NextResponse.json({ error: data.error }, { status: 409 });
      }
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'type must be "reversal" or "clawback"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error creating reversal/clawback:', error);
    return NextResponse.json({ error: 'Failed to create reversal' }, { status: 500 });
  }
}
