import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { AgentForm } from '@/components/agents/AgentForm';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

async function getParentAgents() {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return [];
  const { data: agents } = await (supabase
    .from('advisors')
    .select('id, first_name, last_name, email')
    .eq('organization_id', tenant.organizationId)
    .eq('status', 'active')
    .order('first_name', { ascending: true }) as any);

  return agents ?? [];
}

export default async function NewAgentPage() {
  const parentAgents = await getParentAgents();

  return (
    <div className="space-y-6 max-w-3xl">
      <EntityPageHeader
        backHref="/agents"
        backLabel="Agents"
        title="Add new agent"
        description="Create a new agent record"
      />

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Information</CardTitle>
          <CardDescription>
            Enter the agent&apos;s personal and license information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentForm parentAgents={parentAgents} />
        </CardContent>
      </Card>
    </div>
  );
}
