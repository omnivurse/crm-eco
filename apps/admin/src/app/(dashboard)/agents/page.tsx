import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { AgentTable } from '@/components/agents/AgentTable';

async function getAgents() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return [];

  const { data: agents } = await (supabase
    .from('advisors')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      status,
      license_number,
      license_states,
      commission_tier,
      created_at,
      parent_advisor:advisors!advisors_parent_advisor_id_fkey(id, first_name, last_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(100) as any);

  return agents ?? [];
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
          <p className="text-slate-500">Manage agent accounts and commissions</p>
        </div>
        <Link href="/agents/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </Link>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Agents</CardTitle>
          <CardDescription>{agents.length} agents found</CardDescription>
        </CardHeader>
        <CardContent>
          <AgentTable agents={agents} />
        </CardContent>
      </Card>
    </div>
  );
}
