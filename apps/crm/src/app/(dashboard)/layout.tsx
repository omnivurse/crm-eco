import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import type { Database } from '@crm-eco/lib/types';
import type { UserRole } from '@/lib/auth';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    redirect('/login');
  }

  const profile = data as Profile;

  // Get advisor ID if user is an advisor
  let advisorId: string | null = null;
  if (profile.role === 'advisor') {
    const { data: advisorData } = await supabase
      .from('advisors')
      .select('id')
      .eq('profile_id', profile.id)
      .single();
    
    const advisor = advisorData as { id: string } | null;
    advisorId = advisor?.id ?? null;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar role={profile.role as UserRole} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          profile={{
            fullName: profile.full_name,
            email: profile.email,
            avatarUrl: profile.avatar_url,
            role: profile.role,
          }} 
        />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
