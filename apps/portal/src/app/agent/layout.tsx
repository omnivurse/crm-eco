import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AgentSidebar } from '@/components/agent/AgentSidebar';
import { AgentTopNav } from '@/components/agent/AgentTopNav';
import { Toaster } from 'sonner';

async function getAgentForUser(supabase: any, userId: string) {
  // First, get the profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id, organization_id, role')
    .eq('user_id', userId)
    .single();

  if (!profile || profile.role !== 'advisor') {
    return null;
  }

  // Get the advisor record using profile_id
  const { data: advisor } = await supabase
    .from('advisors')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      status,
      enrollment_code,
      company_name,
      website_url,
      logo_url,
      primary_color,
      secondary_color,
      organization_id
    `)
    .eq('profile_id', profile.id)
    .single();

  return advisor;
}

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/signin');
  }

  const agent = await getAgentForUser(supabase, user.id);

  if (!agent) {
    redirect('/access-denied?reason=not_agent');
  }

  if (agent.status !== 'active') {
    redirect('/access-denied?reason=agent_inactive');
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AgentSidebar agent={agent} />
      <div className="flex-1 flex flex-col">
        <AgentTopNav agent={agent} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
