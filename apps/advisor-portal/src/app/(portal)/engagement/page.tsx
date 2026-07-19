import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  ChatCircle,
  Phone,
  Envelope,
  Calendar,
  FileText,
  Plus,
} from '@phosphor-icons/react/dist/ssr';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

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
    email: Envelope,
    meeting: Calendar,
    note: FileText,
    sms: ChatCircle,
};

const eventTypeColors: Record<string, string> = {
    call: 'bg-[var(--adv-sage-soft)] text-[var(--adv-sage)]',
    email: 'bg-[rgba(11,109,133,0.1)] text-[var(--adv-teal)]',
    meeting: 'bg-[rgba(11,109,133,0.08)] text-[var(--adv-teal)]',
    note: 'bg-[var(--adv-sage-soft)] text-[var(--adv-ink)]',
    sms: 'bg-[rgba(11,109,133,0.12)] text-[var(--adv-teal)]',
};

export default async function EngagementPage() {
    const advisorInfo = await getCurrentAdvisorInfo();

    if (!advisorInfo?.advisor_id) {
        return (
            <div className="flex h-64 items-center justify-center">
                <p className="text-[var(--adv-slate)]">Unable to load engagement data.</p>
            </div>
        );
    }

    const events = await getEngagementEvents(advisorInfo.advisor_id);

    return (
        <div className="space-y-6">
            <PageHeader
                kicker="Outreach"
                title="Engagement"
                description="Track your outreach and follow-ups"
                actions={
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--adv-ink)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        <Plus weight="light" className="h-4 w-4" aria-hidden />
                        Log Activity
                    </button>
                }
            />

            <Bezel>
                <div>
                    {events.length === 0 ? (
                        <div className="p-12 text-center">
                            <ChatCircle
                                weight="light"
                                className="mx-auto mb-4 h-12 w-12 text-[var(--adv-slate)]/40"
                                aria-hidden
                            />
                            <h3 className="adv-display mb-2 text-lg font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                                No engagement activity
                            </h3>
                            <p className="mx-auto mb-6 max-w-sm text-[var(--adv-slate)]">
                                Start logging calls, emails, and meetings to track your outreach.
                            </p>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--adv-teal)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                            >
                                <Plus weight="light" className="h-4 w-4" aria-hidden />
                                Log Your First Activity
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 md:p-5">
                            <div className="relative">
                                <div className="absolute bottom-0 left-5 top-0 w-0.5 bg-[rgba(28,25,23,0.08)]" />

                                <div className="space-y-6">
                                    {events.map((event) => {
                                        const Icon = eventTypeIcons[event.event_type] || ChatCircle;
                                        const colorClass =
                                            eventTypeColors[event.event_type] ||
                                            'bg-[var(--adv-sage-soft)] text-[var(--adv-slate)]';

                                        return (
                                            <div key={event.id} className="relative flex gap-4">
                                                <div
                                                    className={`relative z-10 grid h-10 w-10 place-items-center rounded-[0.85rem] ${colorClass}`}
                                                >
                                                    <Icon weight="light" className="h-5 w-5" aria-hidden />
                                                </div>

                                                <div className="min-w-0 flex-1 pb-6">
                                                    <div className="rounded-[0.85rem] bg-[rgba(28,25,23,0.03)] p-4">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <p className="font-medium capitalize text-[var(--adv-ink)]">
                                                                    {event.event_type}
                                                                    {event.channel && (
                                                                        <span className="font-normal text-[var(--adv-slate)]">
                                                                            {' '}via {event.channel}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                {event.subject && (
                                                                    <p className="mt-1 text-sm text-[var(--adv-ink)]/80">
                                                                        {event.subject}
                                                                    </p>
                                                                )}
                                                                {event.body && (
                                                                    <p className="mt-2 line-clamp-3 text-sm text-[var(--adv-slate)]">
                                                                        {event.body}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className="whitespace-nowrap text-xs text-[var(--adv-slate)]/70">
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
            </Bezel>
        </div>
    );
}
