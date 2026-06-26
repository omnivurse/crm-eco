import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MemberForm } from '@/components/members/MemberForm';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

async function getMember(id: string) {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { data: member } = await (supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single() as any);
  return member ? { member, organizationId: tenant.organizationId } : null;
}

async function getAgents(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: agents } = await (supabase
    .from('advisors')
    .select('id, first_name, last_name, email')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('first_name', { ascending: true }) as any);
  return agents ?? [];
}

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getMember(id);
  if (!result) notFound();

  const { member, organizationId } = result;
  const agents = await getAgents(organizationId);

  const initialData = {
    id: member.id,
    first_name: member.first_name ?? '',
    last_name: member.last_name ?? '',
    email: member.email ?? '',
    phone: member.phone ?? null,
    date_of_birth: member.date_of_birth ?? null,
    gender: member.gender ?? null,
    address_line1: member.address_line1 ?? null,
    address_line2: member.address_line2 ?? null,
    city: member.city ?? null,
    state: member.state ?? null,
    postal_code: member.postal_code ?? null,
    advisor_id: member.advisor_id ?? null,
    market_type: member.market_type ?? null,
    status: member.status ?? 'pending',
    existing_condition: member.existing_condition ?? false,
    existing_condition_description: member.existing_condition_description ?? null,
    is_smoker: member.is_smoker ?? false,
    receive_emails: member.receive_emails ?? true,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/members/${member.id}`}>
          <button className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Member</h1>
          <p className="text-slate-500">
            {member.first_name} {member.last_name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
          <CardDescription>Update the member&apos;s personal and contact information</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm agents={agents} initialData={initialData} />
        </CardContent>
      </Card>
    </div>
  );
}
