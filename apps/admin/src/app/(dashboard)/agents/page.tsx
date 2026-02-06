import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { Plus, Upload, GitBranch, RefreshCw, Users, UserCog } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { AgentTable } from '@/components/agents/AgentTable';
import { PageHeader } from '@/components/ui/PageHeader';

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
      <PageHeader
        title="Agents"
        description="Manage agent accounts and commissions"
        icon={<UserCog className="w-6 h-6" />}
        gradient="from-[#027343] to-[#34d399]"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/agents/bill-groups">
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Bill Groups</span>
              </Button>
            </Link>
            <Link href="/agents/assignment">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Assignment</span>
              </Button>
            </Link>
            <Link href="/agents/tree">
              <Button variant="outline" size="sm">
                <GitBranch className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tree View</span>
              </Button>
            </Link>
            <Link href="/agents/new">
              <Button size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Agent</span>
              </Button>
            </Link>
          </div>
        }
      />

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
