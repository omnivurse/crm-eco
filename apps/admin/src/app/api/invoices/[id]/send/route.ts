import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Marks the invoice sent. Real email stays off unless INVOICE_EMAIL_ENABLED=true
 * and a later approved template send is wired.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;
  const { id } = await params;
  const supabase = createServiceRoleClient() as any;

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, members ( email, first_name )')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (invErr || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const { error: updErr } = await supabase
    .from('invoices')
    .update({
      status: invoice.status === 'draft' ? 'sent' : invoice.status,
      sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const { error: auditErr } = await supabase.from('financial_audit_log').insert({
    organization_id: profile.organization_id,
    action: 'invoice_sent',
    entity_type: 'invoice',
    entity_id: id,
    performed_by: profile.id,
    details: { invoice_number: invoice.invoice_number },
  });
  if (auditErr) console.warn('[invoices] send audit skipped', auditErr.message);

  const member = Array.isArray(invoice.members) ? invoice.members[0] : invoice.members;
  return NextResponse.json({
    ok: true,
    emailed: false,
    invoice_number: invoice.invoice_number,
    recipient: member?.email ?? null,
    note:
      process.env.INVOICE_EMAIL_ENABLED === 'true'
        ? 'Invoice marked sent. Live email is still gated until a template send is approved.'
        : 'Invoice marked sent. Email is dry-run until INVOICE_EMAIL_ENABLED=true.',
  });
}
