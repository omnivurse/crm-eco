import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { BookOpen, ChevronRight, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getPlaybooks(organizationId: string) {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
        .from('advisor_playbooks')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'published')
        .order('sort_order', { ascending: true });

    return data || [];
}

async function getCurrentAdvisorInfo() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

    return profile;
}

export default async function TrainingPage() {
    const advisorInfo = await getCurrentAdvisorInfo();

    if (!advisorInfo?.organization_id) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Unable to load training content.</p>
            </div>
        );
    }

    const playbooks = await getPlaybooks(advisorInfo.organization_id);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Training</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Playbooks and resources to help you succeed
                </p>
            </div>

            {/* Playbooks Grid */}
            {playbooks.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                    <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No training materials yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                        Your administrator will add playbooks and training content here.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {playbooks.map((playbook) => (
                        <div
                            key={playbook.id}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-5 hover:shadow-md transition-shadow cursor-pointer group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-advisor-100 dark:bg-advisor-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <BookOpen className="w-6 h-6 text-advisor-600 dark:text-advisor-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-advisor-600 dark:group-hover:text-advisor-400 transition-colors">
                                        {playbook.title}
                                    </h3>
                                    {playbook.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                            {playbook.description}
                                        </p>
                                    )}
                                    {playbook.category && (
                                        <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                                            {playbook.category}
                                        </span>
                                    )}
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-advisor-500 transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
