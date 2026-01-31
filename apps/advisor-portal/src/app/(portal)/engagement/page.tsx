import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { MessageSquare, Phone, Mail, Calendar, FileText, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getEngagementEvents(advisorId: string) {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
        .from('engagement_events')
        .select('*')
        .eq('advisor_id', advisorId)
        .order('created_at', { ascending: false })
        .limit(50);

    return data || [];
}

async function getCurrentAdvisorInfo() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, advisor_id')
        .eq('user_id', user.id)
        .single();

    return profile;
}

const eventTypeIcons: Record<string, typeof Phone> = {
    call: Phone,
    email: Mail,
    meeting: Calendar,
    note: FileText,
    sms: MessageSquare,
};

const eventTypeColors: Record<string, string> = {
    call: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    email: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    meeting: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    note: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    sms: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default async function EngagementPage() {
    const advisorInfo = await getCurrentAdvisorInfo();

    if (!advisorInfo?.advisor_id) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Unable to load engagement data.</p>
            </div>
        );
    }

    const events = await getEngagementEvents(advisorInfo.advisor_id);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Engagement</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Track your outreach and follow-ups
                    </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-advisor-500 hover:bg-advisor-600 text-white font-medium rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                    Log Activity
                </button>
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                {events.length === 0 ? (
                    <div className="p-12 text-center">
                        <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No engagement activity
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                            Start logging calls, emails, and meetings to track your outreach.
                        </p>
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-advisor-500 hover:bg-advisor-600 text-white font-medium rounded-lg transition-colors">
                            <Plus className="w-4 h-4" />
                            Log Your First Activity
                        </button>
                    </div>
                ) : (
                    <div className="p-4">
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

                            <div className="space-y-6">
                                {events.map((event, index) => {
                                    const Icon = eventTypeIcons[event.event_type] || MessageSquare;
                                    const colorClass = eventTypeColors[event.event_type] || 'bg-gray-100 text-gray-600';

                                    return (
                                        <div key={event.id} className="relative flex gap-4">
                                            {/* Icon */}
                                            <div
                                                className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}
                                            >
                                                <Icon className="w-5 h-5" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 pb-6">
                                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white capitalize">
                                                                {event.event_type}
                                                                {event.channel && (
                                                                    <span className="text-gray-500 dark:text-gray-400 font-normal">
                                                                        {' '}via {event.channel}
                                                                    </span>
                                                                )}
                                                            </p>
                                                            {event.subject && (
                                                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                                                    {event.subject}
                                                                </p>
                                                            )}
                                                            {event.body && (
                                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-3">
                                                                    {event.body}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                                            {new Date(event.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
