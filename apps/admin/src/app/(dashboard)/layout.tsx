import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminSidebar, AdminTopNav, Breadcrumbs } from '@/components/layout';
import { AdminNotificationListener } from '@/components/notifications/AdminNotificationListener';
import { TerminalWrapper } from '@/components/terminal/TerminalWrapper';
import { isAdminRole } from '@/lib/auth';
import type { Database } from '@crm-eco/lib/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Only allow admin roles (owner, admin, staff)
  if (!isAdminRole(profile.role)) {
    redirect('/access-denied');
  }

  return (
    <TerminalWrapper
      profile={{
        id: profile.id,
        role: profile.role,
        full_name: profile.full_name,
      }}
    >
      <div className="flex h-screen bg-slate-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminTopNav
            profile={{
              fullName: profile.full_name,
              email: profile.email,
              avatarUrl: profile.avatar_url,
              role: profile.role,
            }}
            userId={profile.id}
          />
          <AdminNotificationListener userId={profile.id} />
          <main className="flex-1 overflow-auto p-6">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
    </TerminalWrapper>
  );
}
