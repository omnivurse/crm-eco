import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { UsersThree, TrendUp, CurrencyDollar } from '@phosphor-icons/react/dist/ssr';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

export const dynamic = 'force-dynamic';

async function getDownline(advisorId: string) {
    const supabase = await createServerSupabaseClient();

    // Get direct reports
    const { data } = await supabase
        .from('advisors')
        .select(`
      id,
      first_name,
      last_name,
      email,
      status,
      personal_production,
      team_production,
      current_month_commissions
    `)
        .eq('parent_advisor_id', advisorId)
        .order('last_name', { ascending: true });

    return data || [];
}

async function getCurrentAdvisorInfo() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, advisor_id, advisor_role')
        .eq('user_id', user.id)
        .single();

    return profile;
}

export default async function TeamPage() {
    const advisorInfo = await getCurrentAdvisorInfo();

    if (!advisorInfo?.advisor_id) {
        return (
            <div className="flex h-64 items-center justify-center">
                <p className="text-[var(--adv-slate)]">Unable to load team data.</p>
            </div>
        );
    }

    const downline = await getDownline(advisorInfo.advisor_id);

    // Calculate team totals
    const teamStats = {
        members: downline.length,
        production: downline.reduce((sum, a) => sum + (a.personal_production || 0), 0),
        commissions: downline.reduce((sum, a) => sum + (a.current_month_commissions || 0), 0),
    };

    return (
        <div className="space-y-6">
            <PageHeader
                kicker="Organization"
                title="Team"
                description="View your downline and team performance"
            />

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <Bezel>
                    <div className="flex items-center gap-3 p-5">
                        <div className="grid h-10 w-10 place-items-center rounded-[0.85rem] bg-[rgba(11,109,133,0.1)]">
                            <UsersThree weight="light" className="h-5 w-5 text-[var(--adv-teal)]" aria-hidden />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--adv-slate)]">Team Members</p>
                            <p className="adv-display text-xl font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                                {teamStats.members}
                            </p>
                        </div>
                    </div>
                </Bezel>
                <Bezel variant="sage">
                    <div className="flex items-center gap-3 p-5">
                        <div className="grid h-10 w-10 place-items-center rounded-[0.85rem] bg-white/10">
                            <TrendUp weight="light" className="h-5 w-5 text-white" aria-hidden />
                        </div>
                        <div>
                            <p className="text-sm text-white/60">Team Production</p>
                            <p className="adv-display text-xl font-semibold tracking-[-0.02em]">
                                ${teamStats.production.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </Bezel>
                <Bezel variant="deep">
                    <div className="flex items-center gap-3 p-5">
                        <div className="grid h-10 w-10 place-items-center rounded-[0.85rem] bg-white/10">
                            <CurrencyDollar weight="light" className="h-5 w-5 text-white" aria-hidden />
                        </div>
                        <div>
                            <p className="text-sm text-white/60">Team Commissions</p>
                            <p className="adv-display text-xl font-semibold tracking-[-0.02em]">
                                ${teamStats.commissions.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </Bezel>
            </div>

            <Bezel>
                <div>
                    <div className="border-b border-[rgba(28,25,23,0.06)] p-5">
                        <h2 className="adv-display text-lg font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                            Direct Reports
                        </h2>
                    </div>

                    {downline.length === 0 ? (
                        <div className="p-12 text-center">
                            <UsersThree
                                weight="light"
                                className="mx-auto mb-4 h-12 w-12 text-[var(--adv-slate)]/40"
                                aria-hidden
                            />
                            <h3 className="adv-display mb-2 text-lg font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                                No team members
                            </h3>
                            <p className="mx-auto max-w-sm text-[var(--adv-slate)]">
                                Advisors in your downline will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[rgba(28,25,23,0.06)]">
                            {downline.map((advisor) => (
                                <div
                                    key={advisor.id}
                                    className="flex items-center gap-4 p-4 transition-colors hover:bg-[rgba(11,109,133,0.04)]"
                                >
                                    <div className="grid h-10 w-10 place-items-center rounded-[0.85rem] bg-[var(--adv-sage-soft)]">
                                        <span className="font-medium text-[var(--adv-teal)]">
                                            {advisor.first_name?.charAt(0)}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-[var(--adv-ink)]">
                                            {advisor.first_name} {advisor.last_name}
                                        </p>
                                        <p className="text-sm text-[var(--adv-slate)]">{advisor.email}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-[var(--adv-ink)]">
                                            ${(advisor.personal_production || 0).toLocaleString()}
                                        </p>
                                        <p className="text-xs text-[var(--adv-slate)]">production</p>
                                    </div>
                                    <span
                                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                                            advisor.status === 'active'
                                                ? 'bg-[var(--adv-sage-soft)] text-[var(--adv-sage)]'
                                                : 'bg-[rgba(28,25,23,0.06)] text-[var(--adv-slate)]'
                                        }`}
                                    >
                                        {advisor.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Bezel>
        </div>
    );
}
