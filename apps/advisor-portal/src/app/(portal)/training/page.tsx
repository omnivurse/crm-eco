import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { BookOpen, CaretRight } from '@phosphor-icons/react/dist/ssr';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

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
            <div className="flex h-64 items-center justify-center">
                <p className="text-[var(--adv-slate)]">Unable to load training content.</p>
            </div>
        );
    }

    const playbooks = await getPlaybooks(advisorInfo.organization_id);

    return (
        <div className="space-y-6">
            <PageHeader
                kicker="Resources"
                title="Training"
                description="Playbooks and resources to help you succeed"
            />

            {playbooks.length === 0 ? (
                <Bezel>
                    <div className="p-12 text-center">
                        <BookOpen
                            weight="light"
                            className="mx-auto mb-4 h-12 w-12 text-[var(--adv-slate)]/40"
                            aria-hidden
                        />
                        <h3 className="adv-display mb-2 text-lg font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                            No training materials yet
                        </h3>
                        <p className="mx-auto max-w-sm text-[var(--adv-slate)]">
                            Your administrator will add playbooks and training content here.
                        </p>
                    </div>
                </Bezel>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {playbooks.map((playbook) => (
                        <Bezel key={playbook.id}>
                            <div className="p-5">
                                <div className="flex items-start gap-4">
                                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.85rem] bg-[var(--adv-sage-soft)]">
                                        <BookOpen
                                            weight="light"
                                            className="h-6 w-6 text-[var(--adv-teal)]"
                                            aria-hidden
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-[var(--adv-ink)] transition-colors group-hover:text-[var(--adv-teal)]">
                                            {playbook.title}
                                        </h3>
                                        {playbook.description && (
                                            <p className="mt-1 line-clamp-2 text-sm text-[var(--adv-slate)]">
                                                {playbook.description}
                                            </p>
                                        )}
                                        {playbook.category && (
                                            <span className="mt-2 inline-block rounded-full bg-[rgba(28,25,23,0.05)] px-2 py-0.5 text-xs text-[var(--adv-slate)]">
                                                {playbook.category}
                                            </span>
                                        )}
                                    </div>
                                    <CaretRight
                                        weight="light"
                                        className="h-5 w-5 text-[var(--adv-slate)]/40 transition-colors group-hover:text-[var(--adv-teal)]"
                                        aria-hidden
                                    />
                                </div>
                            </div>
                        </Bezel>
                    ))}
                </div>
            )}
        </div>
    );
}
