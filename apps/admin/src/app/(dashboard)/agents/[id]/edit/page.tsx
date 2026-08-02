import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { notFound } from 'next/navigation';
import { AgentForm } from '@/components/agents/AgentForm';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

async function getAgent(id: string) {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { data: agent } = await (supabase
    .from('advisors')
    .select('*')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single() as any);
  return agent ? { agent, organizationId: tenant.organizationId } : null;
}

async function getParentAgents(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: agents } = await (supabase
    .from('advisors')
    .select('id, first_name, last_name, email')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('first_name', { ascending: true }) as any);
  return agents ?? [];
}

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAgent(id);
  if (!result) notFound();

  const { agent, organizationId } = result;
  const parentAgents = await getParentAgents(organizationId);

  const initialData = {
    id: agent.id,
    first_name: agent.first_name ?? '',
    last_name: agent.last_name ?? '',
    email: agent.email ?? '',
    phone: agent.phone ?? null,
    license_number: agent.license_number ?? null,
    license_states: agent.license_states ?? null,
    status: agent.status ?? 'pending',
    commission_tier: agent.commission_tier ?? null,
    commission_eligible: agent.commission_eligible ?? true,
    parent_advisor_id: agent.parent_advisor_id ?? null,
    company_name: agent.company_name ?? null,
    website_url: agent.website_url ?? null,
    primary_color: agent.primary_color ?? null,
    secondary_color: agent.secondary_color ?? null,
    header_bg_color: agent.header_bg_color ?? null,
    header_text_color: agent.header_text_color ?? null,
    street_address: agent.street_address ?? null,
    apartment: agent.apartment ?? null,
    city: agent.city ?? null,
    state: agent.state ?? null,
    zip_code: agent.zip_code ?? null,
    country: agent.country ?? null,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <EntityPageHeader
        backHref={`/agents/${agent.id}`}
        backLabel={`${agent.first_name} ${agent.last_name}`}
        title="Edit agent"
        subtitle={`${agent.first_name} ${agent.last_name}`}
        badges={
          <Badge variant="outline" className="text-xs font-normal capitalize">
            {agent.status ?? 'pending'}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Agent Information</CardTitle>
          <CardDescription>Update the agent&apos;s personal and license information</CardDescription>
        </CardHeader>
        <CardContent>
          <AgentForm parentAgents={parentAgents} initialData={initialData} />
        </CardContent>
      </Card>
    </div>
  );
}
