import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { applyInvoicePayment } from '@crm-eco/lib';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    amount?: number;
    kind?: 'payment' | 'credit';
    paymentMethod?: string;
    referenceNumber?: string;
    notes?: string;
    paymentDate?: string;
  } | null;

  if (!body?.amount || body.amount <= 0) {
    return NextResponse.json({ error: 'amount must be greater than zero' }, { status: 400 });
  }

  const supabase = createServiceRoleClient() as any;

  try {
    const result = await applyInvoicePayment(supabase, {
      organizationId: profile.organization_id,
      invoiceId: id,
      amount: Number(body.amount),
      kind: body.kind === 'credit' ? 'credit' : 'payment',
      paymentMethod: body.paymentMethod,
      referenceNumber: body.referenceNumber,
      notes: body.notes,
      paymentDate: body.paymentDate,
    });
    const { error: auditErr } = await supabase.from('financial_audit_log').insert({
      organization_id: profile.organization_id,
      action: body.kind === 'credit' ? 'invoice_credit' : 'invoice_payment',
      entity_type: 'invoice',
      entity_id: id,
      performed_by: profile.id,
      details: { amount: body.amount, kind: body.kind ?? 'payment', ...result },
    });
    if (auditErr) console.warn('[invoices] payment audit skipped', auditErr.message);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not apply payment' },
      { status: 500 }
    );
  }
}
