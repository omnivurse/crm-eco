import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
    Users,
    DollarSign,
    TrendingUp,
    MessageSquare,
    ArrowUp,
    ArrowDown,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getDashboardStats(organizationId: string, advisorId: string) {
    const supabase = await createServerSupabaseClient();

    // Get contact counts. leads.advisor_id (not owner_advisor_id).
    const leadsResult = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('advisor_id', advisorId);
    const membersResult = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('advisor_id', advisorId);
    const eventsResult = await supabase
        .from('engagement_events')
        .select('id', { count: 'exact', head: true })
        .eq('advisor_id', advisorId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    return {
        leads: leadsResult.count || 0,
        members: membersResult.count || 0,
        recentEvents: eventsResult.count || 0,
    };
}

async function getRecentActivity(advisorId: string) {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
        .from('engagement_events')
        .select('*')
        .eq('advisor_id', advisorId)
        .order('created_at', { ascending: false })
        .limit(5);

    return data || [];
}

async function getCurrentAdvisorInfo() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select(`
      id,
      advisor_id,
      organization_id,
      advisors!profiles_advisor_id_fkey (
        id,
        first_name,
        last_name,
        current_month_commissions,
        personal_production,
        team_production
      )
    `)
        .eq('user_id', user.id)
        .single();

    return profile;
}

export default async function DashboardPage() {
    const advisorInfo = await getCurrentAdvisorInfo();

    if (!advisorInfo?.advisor_id || !advisorInfo?.organization_id) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Unable to load dashboard data.</p>
            </div>
        );
    }

    const [stats, recentActivity] = await Promise.all([
        getDashboardStats(advisorInfo.organization_id, advisorInfo.advisor_id),
        getRecentActivity(advisorInfo.advisor_id),
    ]);

    const advisor = advisorInfo.advisors;
    const commissions = advisor?.current_month_commissions || 0;
    const personalProd = advisor?.personal_production || 0;
    const teamProd = advisor?.team_production || 0;

    const kpis = [
        {
            name: 'Leads',
            value: stats.leads.toString(),
            icon: Users,
            change: '+12%',
            positive: true,
            color: 'bg-blue-500',
        },
        {
            name: 'Members',
            value: stats.members.toString(),
            icon: Users,
            change: '+5%',
            positive: true,
            color: 'bg-advisor-500',
        },
        {
            name: 'Commissions MTD',
            value: `$${commissions.toLocaleString()}`,
            icon: DollarSign,
            change: '+18%',
            positive: true,
            color: 'bg-emerald-500',
        },
        {
            name: 'Production',
            value: `$${(personalProd + teamProd).toLocaleString()}`,
            icon: TrendingUp,
            change: '-3%',
            positive: false,
            color: 'bg-purple-500',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {advisor?.first_name || 'Advisor'}!
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Here&apos;s what&apos;s happening with your book of business.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi) => (
                    <div
                        key={kpi.name}
                        className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${kpi.color} rounded-lg flex items-center justify-center`}>
                                <kpi.icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{kpi.name}</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-sm">
                            {kpi.positive ? (
                                <ArrowUp className="w-4 h-4 text-green-500" />
                            ) : (
                                <ArrowDown className="w-4 h-4 text-red-500" />
                            )}
                            <span className={kpi.positive ? 'text-green-600' : 'text-red-600'}>
                                {kpi.change}
                            </span>
                            <span className="text-gray-400">vs last month</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-advisor-500" />
                        <h2 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                    </div>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {recentActivity.length === 0 ? (
                        <div className="p-8 text-center">
                            <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                Start engaging with your contacts to see activity here.
                            </p>
                        </div>
                    ) : (
                        recentActivity.map((event) => (
                            <div key={event.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-advisor-100 dark:bg-advisor-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                        <MessageSquare className="w-4 h-4 text-advisor-600 dark:text-advisor-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                            {event.event_type} {event.channel && `via ${event.channel}`}
                                        </p>
                                        {event.subject && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                {event.subject}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            {new Date(event.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
