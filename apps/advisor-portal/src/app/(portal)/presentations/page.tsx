import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Presentation, Plus, ExternalLink, Eye } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getPresentations(profileId: string) {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
        .from('presentations')
        .select(`
      id,
      title,
      share_slug,
      is_public,
      views_count,
      created_at,
      template:presentation_templates(name)
    `)
        .eq('created_by', profileId)
        .order('created_at', { ascending: false });

    return data || [];
}

async function getTemplates(organizationId: string) {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
        .from('presentation_templates')
        .select('id, name, description, thumbnail_url')
        .eq('organization_id', organizationId)
        .eq('status', 'active');

    return data || [];
}

async function getCurrentAdvisorInfo() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

    return profile;
}

export default async function PresentationsPage() {
    const advisorInfo = await getCurrentAdvisorInfo();

    if (!advisorInfo?.id || !advisorInfo?.organization_id) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Unable to load presentations.</p>
            </div>
        );
    }

    const [presentations, templates] = await Promise.all([
        getPresentations(advisorInfo.id),
        getTemplates(advisorInfo.organization_id),
    ]);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Presentations</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Create and share presentations with your contacts
                    </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-advisor-500 hover:bg-advisor-600 text-white font-medium rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                    New Presentation
                </button>
            </div>

            {/* Templates */}
            {templates.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Templates</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer group"
                            >
                                <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg mb-3 flex items-center justify-center">
                                    {template.thumbnail_url ? (
                                        <img
                                            src={template.thumbnail_url}
                                            alt={template.name}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                    ) : (
                                        <Presentation className="w-8 h-8 text-gray-400" />
                                    )}
                                </div>
                                <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-advisor-600 transition-colors">
                                    {template.name}
                                </h3>
                                {template.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                        {template.description}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* My Presentations */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    My Presentations
                </h2>

                {presentations.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <Presentation className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No presentations yet
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                            Create your first presentation from a template to share with contacts.
                        </p>
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-advisor-500 hover:bg-advisor-600 text-white font-medium rounded-lg transition-colors">
                            <Plus className="w-4 h-4" />
                            Create Presentation
                        </button>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {presentations.map((pres) => (
                                <div
                                    key={pres.id}
                                    className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    <div className="w-10 h-10 bg-advisor-100 dark:bg-advisor-900/30 rounded-lg flex items-center justify-center">
                                        <Presentation className="w-5 h-5 text-advisor-600 dark:text-advisor-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">
                                            {pres.title}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {pres.template?.name && `From: ${pres.template.name} • `}
                                            {new Date(pres.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                        <Eye className="w-4 h-4" />
                                        {pres.views_count || 0}
                                    </div>
                                    {pres.share_slug && pres.is_public && (
                                        <a
                                            href={`/shared/${pres.share_slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-gray-400 hover:text-advisor-500 transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
