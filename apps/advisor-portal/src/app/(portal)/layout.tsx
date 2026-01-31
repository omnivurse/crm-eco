import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { PortalShell } from '@/components/shell/PortalShell';

export const dynamic = 'force-dynamic';

async function getCurrentAdvisor() {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select(`
      id,
      full_name,
      email,
      avatar_url,
      advisor_role,
      advisor_id,
      organization_id,
      advisors!profiles_advisor_id_fkey (
        id,
        first_name,
        last_name,
        agency_name,
        advisor_code,
        personal_production,
        team_production,
        current_month_commissions
      )
    `)
        .eq('user_id', user.id)
        .single();

    return profile;
}

export default async function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const profile = await getCurrentAdvisor();

    if (!profile) {
        redirect('/login');
    }

    if (!profile.advisor_role) {
        redirect('/login?error=no_advisor_access');
    }

    return (
        <PortalShell profile={profile}>
            {children}
        </PortalShell>
    );
}
