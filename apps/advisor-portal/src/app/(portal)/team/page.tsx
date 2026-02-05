import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Users2, TrendingUp, DollarSign, ChevronRight } from 'lucide-react';

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
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Unable to load team data.</p>
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
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Team</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    View your downline and team performance
                </p>
            </div>

            {/* Team Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Users2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Team Members</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{teamStats.members}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-advisor-100 dark:bg-advisor-900/30 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-advisor-600 dark:text-advisor-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Team Production</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                ${teamStats.production.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Team Commissions</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                ${teamStats.commissions.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Team List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="p-3 sm:p-5 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="font-semibold text-gray-900 dark:text-white">Direct Reports</h2>
                </div>

                {downline.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No team members
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                            Advisors in your downline will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {downline.map((advisor) => (
                            <div
                                key={advisor.id}
                                className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-advisor-100 dark:bg-advisor-900/30 flex items-center justify-center">
                                    <span className="text-advisor-700 dark:text-advisor-400 font-medium">
                                        {advisor.first_name?.charAt(0)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {advisor.first_name} {advisor.last_name}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{advisor.email}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        ${(advisor.personal_production || 0).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">production</p>
                                </div>
                                <span
                                    className={`px-2 py-1 text-xs font-medium rounded-full ${advisor.status === 'active'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}
                                >
                                    {advisor.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
