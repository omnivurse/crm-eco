import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/AdminShell';
import { AdminNotificationListener } from '@/components/notifications/AdminNotificationListener';
import { TerminalWrapper } from '@/components/terminal/TerminalWrapper';
import { getAdminProfile } from '@/lib/profile';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use cached profile getter - memoized per-request
  const profile = await getAdminProfile();

  if (!profile) {
    redirect('/login');
  }

  // Only allow admin roles (owner, admin, staff)
  if (!profile.isAdmin) {
    redirect('/access-denied');
  }

  return (
    <TerminalWrapper
      profile={{
        id: profile.id,
        role: profile.role || undefined,
        full_name: profile.full_name || undefined,
      }}
    >
      <AdminShell
        profile={{
          fullName: profile.full_name || '',
          email: profile.email,
          avatarUrl: null,
          role: profile.role || '',
          organizationId: profile.organization_id,
        }}
        userId={profile.id}
      >
        <AdminNotificationListener userId={profile.id} />
        {children}
      </AdminShell>
    </TerminalWrapper>
  );
}
