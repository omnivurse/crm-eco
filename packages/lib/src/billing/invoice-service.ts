import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyInvoiceMoney,
  buildInvoiceHtml,
  computeBillingInvoiceTotals,
  type InvoiceLineInput,
} from './invoice-os';

type AnyClient = SupabaseClient;

async function nextInvoiceNumber(supabase: AnyClient, organizationId: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_invoice_number', { org_id: organizationId });
  if (!error && typeof data === 'string' && data.trim()) return data;
  return `INV-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
}

export async function generateMemberInvoice(
  supabase: AnyClient,
  input: {
    organizationId: string;
    memberId: string;
    lines: InvoiceLineInput[];
    taxRate?: number | null;
    dueDate: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    notes?: string | null;
    isRetro?: boolean;
    retroReason?: string | null;
    createdBy?: string | null;
    generationJobId?: string | null;
    title?: string | null;
  }
) {
  const totals = computeBillingInvoiceTotals({
    lines: input.lines,
    taxRate: input.taxRate,
    amountPaid: 0,
  });
  if (totals.total <= 0) throw new Error('Invoice total must be greater than zero');

  const invoiceNumber = await nextInvoiceNumber(supabase, input.organizationId);
  const payload = {
    organization_id: input.organizationId,
    invoice_number: invoiceNumber,
    title: input.title ?? 'Membership invoice',
    member_id: input.memberId,
    status: 'draft',
    payer_type: 'member',
    period_start: input.periodStart ?? null,
    period_end: input.periodEnd ?? null,
    subtotal: totals.subtotal,
    tax_rate: totals.tax_rate,
    tax_amount: totals.tax_amount,
    total: totals.total,
    amount_paid: 0,
    balance_due: totals.balance_due,
    due_date: input.dueDate,
    notes: input.notes ?? null,
    is_retro: input.isRetro ?? false,
    retro_reason: input.isRetro ? input.retroReason ?? null : null,
    generation_job_id: input.generationJobId ?? null,
    created_by: input.createdBy ?? null,
    line_items: input.lines.map((line) => ({
      name: line.name,
      description: line.description ?? null,
      quantity: line.quantity,
      unit_price: line.unit_price,
      total: Math.round(line.quantity * line.unit_price * 100) / 100,
    })),
  };

  const { data: invoice, error } = await supabase.from('invoices').insert(payload).select('id, invoice_number, total').single();
  if (error || !invoice) throw new Error(error?.message ?? 'Could not create invoice');

  if (input.lines.length > 0) {
    const { error: lineErr } = await supabase.from('invoice_line_items').insert(
      input.lines.map((line, index) => ({
        invoice_id: invoice.id,
        product_id: line.product_id ?? null,
        name: line.name,
        description: line.description ?? null,
        quantity: line.quantity,
        unit_price: line.unit_price,
        total: Math.round(line.quantity * line.unit_price * 100) / 100,
        sort_order: index,
      }))
    );
    if (lineErr) throw new Error(lineErr.message);
  }

  return invoice;
}

export async function generateGroupInvoices(
  supabase: AnyClient,
  input: {
    organizationId: string;
    groupId: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    taxRate?: number | null;
    isRetro?: boolean;
    retroReason?: string | null;
    createdBy?: string | null;
  }
) {
  const { data: group, error: groupErr } = await supabase
    .from('invoice_groups')
    .select('id, name')
    .eq('id', input.groupId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (groupErr || !group) throw new Error(groupErr?.message ?? 'Invoice group not found');

  const { data: memberships, error: memErr } = await supabase
    .from('invoice_group_members')
    .select('member_id')
    .eq('invoice_group_id', input.groupId);
  if (memErr) throw new Error(memErr.message);

  const memberIds = (memberships ?? []).map((row: { member_id: string }) => row.member_id);
  const { data: members, error: peopleErr } = await supabase
    .from('members')
    .select('id, first_name, last_name, monthly_share')
    .in('id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);
  if (peopleErr) throw new Error(peopleErr.message);

  const { data: job, error: jobErr } = await supabase
    .from('invoice_generation_jobs')
    .insert({
      organization_id: input.organizationId,
      job_type: 'group',
      job_name: `${group.name} ${input.periodStart}`,
      invoice_group_id: input.groupId,
      status: 'processing',
      billing_period_start: input.periodStart,
      billing_period_end: input.periodEnd,
      due_date: input.dueDate,
      is_retro: input.isRetro ?? false,
      retro_reason: input.isRetro ? input.retroReason ?? null : null,
      started_at: new Date().toISOString(),
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single();
  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Could not start generation job');

  let successful = 0;
  let failed = 0;
  let totalAmount = 0;
  const errors: Array<{ member_id: string; error: string }> = [];

  for (const member of members ?? []) {
    try {
      const amount = Number(member.monthly_share) || 0;
      if (amount <= 0) {
        failed += 1;
        errors.push({
          member_id: member.id,
          error: 'Skipped: monthly_share is missing or zero',
        });
        continue;
      }
      const created = await generateMemberInvoice(supabase, {
        organizationId: input.organizationId,
        memberId: member.id,
        lines: [
          {
            name: `${group.name} membership`,
            quantity: 1,
            unit_price: amount,
          },
        ],
        taxRate: input.taxRate,
        dueDate: input.dueDate,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        isRetro: input.isRetro,
        retroReason: input.retroReason,
        createdBy: input.createdBy,
        generationJobId: job.id,
        title: `${group.name} — ${input.periodStart} to ${input.periodEnd}`,
      });
      successful += 1;
      totalAmount += Number(created.total) || 0;
    } catch (err) {
      failed += 1;
      errors.push({
        member_id: member.id,
        error: err instanceof Error ? err.message : 'Failed',
      });
    }
  }

  await supabase
    .from('invoice_generation_jobs')
    .update({
      status: 'completed',
      total_invoices: (members ?? []).length,
      successful_invoices: successful,
      failed_invoices: failed,
      total_amount: totalAmount,
      completed_at: new Date().toISOString(),
      result_details: { errors },
    })
    .eq('id', job.id);

  await supabase
    .from('invoice_groups')
    .update({
      last_generated_at: new Date().toISOString(),
      last_generated_by: input.createdBy ?? null,
    })
    .eq('id', input.groupId);

  return { jobId: job.id, successful, failed, totalAmount, errors };
}

export async function applyInvoicePayment(
  supabase: AnyClient,
  input: {
    organizationId: string;
    invoiceId: string;
    amount: number;
    kind: 'payment' | 'credit';
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
    paymentDate?: string | null;
  }
) {
  if (!(input.amount > 0)) throw new Error('Amount must be greater than zero');

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, total, amount_paid, status, organization_id')
    .eq('id', input.invoiceId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (error || !invoice) throw new Error(error?.message ?? 'Invoice not found');

  const next = applyInvoiceMoney({
    total: Number(invoice.total) || 0,
    amountPaid: Number(invoice.amount_paid) || 0,
    application: input.amount,
    previousStatus: invoice.status,
  });

  const { error: payErr } = await supabase.from('invoice_payments').insert({
    invoice_id: input.invoiceId,
    amount: input.amount,
    payment_method: input.kind === 'credit' ? input.paymentMethod || 'credit' : input.paymentMethod || 'manual',
    payment_date: input.paymentDate || new Date().toISOString().slice(0, 10),
    reference_number: input.referenceNumber ?? null,
    notes: input.notes ?? (input.kind === 'credit' ? 'Credit applied' : null),
  });
  if (payErr) throw new Error(payErr.message);

  const { error: updErr } = await supabase
    .from('invoices')
    .update({
      amount_paid: next.amount_paid,
      balance_due: next.balance_due,
      status: next.status,
      paid_at: next.status === 'paid' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.invoiceId)
    .eq('organization_id', input.organizationId);
  if (updErr) throw new Error(updErr.message);

  return next;
}

export async function renderInvoiceHtml(
  supabase: AnyClient,
  input: { organizationId: string; invoiceId: string }
): Promise<string> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      `
      invoice_number, title, notes, due_date, period_start, period_end,
      subtotal, tax_amount, total, amount_paid, balance_due, line_items,
      members ( first_name, last_name ),
      organizations ( name )
    `
    )
    .eq('id', input.invoiceId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (error || !invoice) throw new Error(error?.message ?? 'Invoice not found');

  const { data: lineRows } = await supabase
    .from('invoice_line_items')
    .select('name, quantity, unit_price, total')
    .eq('invoice_id', input.invoiceId)
    .order('sort_order');

  const jsonLines = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const lines =
    (lineRows ?? []).length > 0
      ? lineRows!.map((row) => ({
          name: row.name,
          quantity: Number(row.quantity) || 1,
          unit_price: Number(row.unit_price) || 0,
          total: Number(row.total) || 0,
        }))
      : jsonLines.map((row) => {
          const line = row as {
            name?: string;
            description?: string;
            quantity?: number;
            unit_price?: number;
            amount?: number;
            total?: number;
          };
          return {
            name: line.name || line.description || 'Line',
            quantity: Number(line.quantity) || 1,
            unit_price: Number(line.unit_price || line.amount) || 0,
            total: Number(line.total || line.amount) || 0,
          };
        });

  const member = Array.isArray(invoice.members) ? invoice.members[0] : invoice.members;
  const org = Array.isArray(invoice.organizations) ? invoice.organizations[0] : invoice.organizations;

  return buildInvoiceHtml({
    invoiceNumber: invoice.invoice_number,
    title: invoice.title,
    orgName: org?.name || 'Invoice',
    billTo: member ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'Member' : 'Member',
    period: invoice.period_start ? `${invoice.period_start} – ${invoice.period_end}` : null,
    dueDate: invoice.due_date,
    notes: invoice.notes,
    lines,
    totals: {
      subtotal: Number(invoice.subtotal) || 0,
      tax_amount: Number(invoice.tax_amount) || 0,
      total: Number(invoice.total) || 0,
      amount_paid: Number(invoice.amount_paid) || 0,
      balance_due: Number(invoice.balance_due) || 0,
    },
  });
}
