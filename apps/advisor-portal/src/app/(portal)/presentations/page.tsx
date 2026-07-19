import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { MonitorPlay, Plus, ArrowSquareOut, Eye } from '@phosphor-icons/react/dist/ssr';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

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
            <div className="flex h-64 items-center justify-center">
                <p className="text-[var(--adv-slate)]">Unable to load presentations.</p>
            </div>
        );
    }

    const [presentations, templates] = await Promise.all([
        getPresentations(advisorInfo.id),
        getTemplates(advisorInfo.organization_id),
    ]);

    return (
        <div className="space-y-6">
            <PageHeader
                kicker="Share"
                title="Presentations"
                description="Create and share presentations with your contacts"
                actions={
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--adv-ink)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        <Plus weight="light" className="h-4 w-4" aria-hidden />
                        New Presentation
                    </button>
                }
            />

            {templates.length > 0 && (
                <div>
                    <h2 className="adv-display mb-4 text-lg font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                        Templates
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {templates.map((template) => (
                            <Bezel key={template.id}>
                                <div className="group cursor-pointer p-4">
                                    <div className="mb-3 flex aspect-video items-center justify-center rounded-[0.85rem] bg-[var(--adv-sage-soft)]">
                                        {template.thumbnail_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- dynamic external thumbnail URL
                                            <img
                                                src={template.thumbnail_url}
                                                alt={template.name}
                                                className="h-full w-full rounded-[0.85rem] object-cover"
                                            />
                                        ) : (
                                            <MonitorPlay
                                                weight="light"
                                                className="h-8 w-8 text-[var(--adv-slate)]/50"
                                                aria-hidden
                                            />
                                        )}
                                    </div>
                                    <h3 className="font-medium text-[var(--adv-ink)] transition-colors group-hover:text-[var(--adv-teal)]">
                                        {template.name}
                                    </h3>
                                    {template.description && (
                                        <p className="mt-1 line-clamp-2 text-sm text-[var(--adv-slate)]">
                                            {template.description}
                                        </p>
                                    )}
                                </div>
                            </Bezel>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h2 className="adv-display mb-4 text-lg font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                    My Presentations
                </h2>

                {presentations.length === 0 ? (
                    <Bezel>
                        <div className="p-12 text-center">
                            <MonitorPlay
                                weight="light"
                                className="mx-auto mb-4 h-12 w-12 text-[var(--adv-slate)]/40"
                                aria-hidden
                            />
                            <h3 className="adv-display mb-2 text-lg font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                                No presentations yet
                            </h3>
                            <p className="mx-auto mb-6 max-w-sm text-[var(--adv-slate)]">
                                Create your first presentation from a template to share with contacts.
                            </p>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--adv-teal)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                            >
                                <Plus weight="light" className="h-4 w-4" aria-hidden />
                                Create Presentation
                            </button>
                        </div>
                    </Bezel>
                ) : (
                    <Bezel>
                        <div className="divide-y divide-[rgba(28,25,23,0.06)] overflow-hidden">
                            {presentations.map((pres) => (
                                <div
                                    key={pres.id}
                                    className="flex items-center gap-4 p-4 transition-colors hover:bg-[rgba(11,109,133,0.04)]"
                                >
                                    <div className="grid h-10 w-10 place-items-center rounded-[0.85rem] bg-[var(--adv-sage-soft)]">
                                        <MonitorPlay
                                            weight="light"
                                            className="h-5 w-5 text-[var(--adv-teal)]"
                                            aria-hidden
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-[var(--adv-ink)]">
                                            {pres.title}
                                        </p>
                                        <p className="text-sm text-[var(--adv-slate)]">
                                            {pres.template?.name && `From: ${pres.template.name} • `}
                                            {new Date(pres.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-[var(--adv-slate)]">
                                        <Eye weight="light" className="h-4 w-4" aria-hidden />
                                        {pres.views_count || 0}
                                    </div>
                                    {pres.share_slug && pres.is_public && (
                                        <a
                                            href={`/shared/${pres.share_slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-[var(--adv-slate)]/50 transition-colors hover:text-[var(--adv-teal)]"
                                        >
                                            <ArrowSquareOut weight="light" className="h-4 w-4" aria-hidden />
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Bezel>
                )}
            </div>
        </div>
    );
}
