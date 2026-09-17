import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireEmployerSponsors } from '@/lib/employer';
import { EmployerSponsorConsole } from '@/components/employer/EmployerSponsorConsole';

export const dynamic = 'force-dynamic';

export default async function EmployerSponsorPage({
  params,
}: {
  params: Promise<{ sponsorId: string }>;
}) {
  const { sponsorId } = await params;
  const ctx = await requireEmployerSponsors();
  if (!ctx) redirect('/signin?redirect=/employer');

  const sponsor = ctx.sponsors.find((s) => s.id === sponsorId);
  if (!sponsor) notFound();

  const supabase = (await createServerSupabaseClient()) as any;
  const service = createServiceRoleClient() as any;
  const [{ data: roster }, { data: invoices }, { data: approvals }] = await Promise.all([
    supabase
      .from('sponsor_roster')
      .select('id, first_name, last_name, date_of_birth, email, relationship, status, eligible_end')
      .eq('sponsor_id', sponsorId)
      .order('last_name')
      .limit(300),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total, period_start, period_end, due_date')
      .eq('sponsor_id', sponsorId)
      .eq('payer_type', 'sponsor')
      .order('created_at', { ascending: false })
      .limit(24),
    service
      .from('sponsorships')
      .select('id, status, role, member_id, members ( first_name, last_name, email )')
      .eq('sponsor_id', sponsorId)
      .eq('status', 'needs_approval')
      .limit(50),
  ]);

  const approvalRows = (approvals ?? []).map((row: {
    id: string;
    status: string;
    role: string;
    member_id: string | null;
    members?: { first_name?: string; last_name?: string; email?: string } | { first_name?: string; last_name?: string; email?: string }[] | null;
  }) => {
    const member = Array.isArray(row.members) ? row.members[0] : row.members;
    const name = [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim();
    return {
      id: row.id,
      status: row.status,
      role: row.role,
      member_id: row.member_id,
      name: name || 'Unknown person',
      email: member?.email ?? null,
    };
  });

  return (
    <EmployerSponsorConsole
      sponsorId={sponsor.id}
      sponsorName={sponsor.name}
      role={sponsor.role}
      roster={roster ?? []}
      invoices={invoices ?? []}
      approvals={approvalRows}
    />
  );
}
