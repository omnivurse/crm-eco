import type { SponsorInvoiceDraft, SponsorInvoiceLine, SponsorRelationship } from './types';

export interface BillableSponsorship {
  roster_id: string | null;
  member_id: string | null;
  membership_id: string | null;
  first_name: string;
  last_name: string;
  role: SponsorRelationship;
  amount: number;
  plan_id: string | null;
  plan_name: string | null;
  status: string;
  effective_date: string | null;
  end_date: string | null;
}

export function buildSponsorInvoiceDraft(input: {
  sponsor_id: string;
  organization_id: string;
  sponsor_name: string;
  period_start: string;
  period_end: string;
  rows: BillableSponsorship[];
}): SponsorInvoiceDraft {
  const lines: SponsorInvoiceLine[] = input.rows
    .filter((row) => isCoveredInPeriod(row, input.period_start, input.period_end))
    .map((row) => ({
      roster_id: row.roster_id,
      member_id: row.member_id,
      membership_id: row.membership_id,
      name: `${row.first_name} ${row.last_name}`.trim(),
      role: row.role,
      amount: Number(row.amount) || 0,
      plan_id: row.plan_id,
      plan_name: row.plan_name,
    }));

  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  return {
    sponsor_id: input.sponsor_id,
    organization_id: input.organization_id,
    period_start: input.period_start,
    period_end: input.period_end,
    title: `${input.sponsor_name} — ${input.period_start} to ${input.period_end}`,
    line_items: lines,
    subtotal,
    total: subtotal,
    headcount: lines.length,
  };
}

export function isCoveredInPeriod(
  row: Pick<BillableSponsorship, 'status' | 'effective_date' | 'end_date'>,
  periodStart: string,
  periodEnd: string
): boolean {
  if (row.status === 'ended' || row.status === 'needs_approval') return false;
  if (row.effective_date && row.effective_date > periodEnd) return false;
  if (row.end_date && row.end_date < periodStart) return false;
  return true;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
