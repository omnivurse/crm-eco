import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AgentForm } from '@/components/agents/AgentForm';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

async function getParentAgents() {
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
    .select('id, first_name, last_name, email')
    .eq('organization_id', profile.organization_id)
    .eq('status', 'active')
    .order('first_name', { ascending: true }) as any);

  return agents ?? [];
}

export default async function NewAgentPage() {
  const parentAgents = await getParentAgents();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agents">
          <button className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add New Agent</h1>
          <p className="text-slate-500">Create a new agent record</p>
        </div>
      </div>

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
