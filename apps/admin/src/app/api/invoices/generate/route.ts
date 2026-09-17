import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { generateGroupInvoices, generateMemberInvoice } from '@crm-eco/lib';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function writeInvoiceAudit(
  supabase: any,
  row: Record<string, unknown>
) {
  const { error } = await supabase.from('financial_audit_log').insert(row);
  if (error) console.warn('[invoices] audit skipped', error.message);
}

export async function POST(request: Request) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const body = (await request.json().catch(() => null)) as {
    mode?: 'member' | 'group';
    memberId?: string;
    groupId?: string;
    lines?: Array<{
      name?: string;
      description?: string;
      quantity?: number;
      unit_price?: number;
      product_id?: string | null;
    }>;
    taxRate?: number | null;
    dueDate?: string;
    periodStart?: string;
    periodEnd?: string;
    notes?: string | null;
    isRetro?: boolean;
    retroReason?: string | null;
    title?: string | null;
  } | null;

  if (!body?.dueDate) {
    return NextResponse.json({ error: 'dueDate is required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient() as any;

  try {
    if (body.mode === 'group') {
      if (!body.groupId || !body.periodStart || !body.periodEnd) {
        return NextResponse.json(
          { error: 'groupId, periodStart, and periodEnd are required' },
          { status: 400 }
        );
      }
      const result = await generateGroupInvoices(supabase, {
        organizationId: profile.organization_id,
        groupId: body.groupId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        dueDate: body.dueDate,
        taxRate: body.taxRate,
        isRetro: body.isRetro,
        retroReason: body.retroReason,
        createdBy: profile.id,
      });
      await writeInvoiceAudit(supabase, {
        organization_id: profile.organization_id,
        action: 'invoice_batch_generated',
        entity_type: 'invoice_generation_job',
        entity_id: result.jobId,
        performed_by: profile.id,
        details: {
          group_id: body.groupId,
          successful: result.successful,
          failed: result.failed,
          total_amount: result.totalAmount,
        },
      });
      return NextResponse.json(result);
    }

    if (!body.memberId || !body.lines?.length) {
      return NextResponse.json({ error: 'memberId and lines are required' }, { status: 400 });
    }
    const invoice = await generateMemberInvoice(supabase, {
      organizationId: profile.organization_id,
      memberId: body.memberId,
      lines: body.lines.map((line) => ({
        name: line.name || line.description || 'Line',
        description: line.description ?? null,
        quantity: Number(line.quantity) || 1,
        unit_price: Number(line.unit_price) || 0,
        product_id: line.product_id ?? null,
      })),
      taxRate: body.taxRate,
      dueDate: body.dueDate,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      notes: body.notes,
      isRetro: body.isRetro,
      retroReason: body.retroReason,
      createdBy: profile.id,
      title: body.title,
    });
    await writeInvoiceAudit(supabase, {
      organization_id: profile.organization_id,
      action: 'invoice_created',
      entity_type: 'invoice',
      entity_id: invoice.id,
      performed_by: profile.id,
      details: {
        invoice_number: invoice.invoice_number,
        member_id: body.memberId,
        total: invoice.total,
      },
    });
    return NextResponse.json(invoice);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invoice generation failed' },
      { status: 500 }
    );
  }
}
