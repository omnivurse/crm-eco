import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  applyActiveCrmLeadsFilters,
  resolveLeadsModuleId,
} from '@crm-eco/lib';
import {
  ArrowUpRight,
  ChatCircle,
  EnvelopeSimple,
  Note,
  Phone,
} from '@phosphor-icons/react/dist/ssr';
import { Bezel } from '@/components/ui/Bezel';

export const dynamic = 'force-dynamic';

async function getDashboardStats(organizationId: string, advisorId: string) {
  const supabase = await createServerSupabaseClient();
  const leadsModuleId = await resolveLeadsModuleId(supabase, organizationId);

  let leadsCount = 0;
  if (leadsModuleId) {
    const leadsResult = await (applyActiveCrmLeadsFilters(
      (supabase as any)
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', organizationId)
        .eq('module_id', leadsModuleId)
        .eq('advisor_id', advisorId),
      organizationId,
      leadsModuleId,
    ) as Promise<{ count: number | null }>);
    leadsCount = leadsResult.count || 0;
  }

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
    leads: leadsCount,
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

function ActivityIcon({ type }: { type: string }) {
  const common = 'h-4 w-4';
  switch (type) {
    case 'call':
      return <Phone weight="light" className={common} aria-hidden />;
    case 'email':
      return <EnvelopeSimple weight="light" className={common} aria-hidden />;
    case 'note':
      return <Note weight="light" className={common} aria-hidden />;
    default:
      return <ChatCircle weight="light" className={common} aria-hidden />;
  }
}

export default async function DashboardPage() {
  const advisorInfo = await getCurrentAdvisorInfo();

  if (!advisorInfo?.advisor_id || !advisorInfo?.organization_id) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[var(--adv-slate)]">Unable to load dashboard data.</p>
      </div>
    );
  }

  const [stats, recentActivity] = await Promise.all([
    getDashboardStats(advisorInfo.organization_id, advisorInfo.advisor_id),
    getRecentActivity(advisorInfo.advisor_id),
  ]);

  const advisor = advisorInfo.advisors as {
    first_name?: string;
    last_name?: string;
    current_month_commissions?: number;
    personal_production?: number;
    team_production?: number;
  } | null;

  const commissions = advisor?.current_month_commissions || 0;
  const personalProd = advisor?.personal_production || 0;
  const teamProd = advisor?.team_production || 0;
  const production = personalProd + teamProd;

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8 min-[900px]:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] min-[900px]:items-start">
      {/* Editorial left */}
      <div className="adv-reveal">
        <span className="adv-kicker mb-4">Book of business</span>
        <h1 className="adv-display mb-3 text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--adv-ink)]">
          Welcome back,
          <br />
          <em className="not-italic text-[var(--adv-teal)] italic font-medium">
            {advisor?.first_name || 'Advisor'}
          </em>
        </h1>
        <p className="mb-7 max-w-md text-[1.05rem] leading-relaxed text-[var(--adv-slate)]">
          A calm view of your pipeline, production, and recent engagement — so you know
          exactly where to lean in today.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/contacts" className="adv-btn-island">
            Open contacts
            <span className="adv-btn-ico" aria-hidden>
              <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
            </span>
          </Link>
          <Link href="/engagement" className="adv-btn-ghost">
            Log engagement
          </Link>
        </div>
      </div>

      {/* KPI stack + activity */}
      <div className="flex flex-col gap-4">
        <div className="adv-reveal grid grid-cols-2 gap-3.5">
          <Bezel variant="deep">
            <div className="p-5 md:p-6">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                Commissions MTD
              </p>
              <p className="adv-display text-[clamp(1.75rem,3vw,2.15rem)] font-semibold leading-none tracking-[-0.03em]">
                ${commissions.toLocaleString()}
              </p>
            </div>
          </Bezel>
          <Bezel variant="sage">
            <div className="p-5 md:p-6">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                Production
              </p>
              <p className="adv-display text-[clamp(1.75rem,3vw,2.15rem)] font-semibold leading-none tracking-[-0.03em]">
                ${production.toLocaleString()}
              </p>
            </div>
          </Bezel>
          <Bezel>
            <div className="p-5 md:p-6">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adv-slate)]">
                Leads
              </p>
              <p className="adv-display text-[clamp(1.75rem,3vw,2.15rem)] font-semibold leading-none tracking-[-0.03em] text-[var(--adv-ink)]">
                {stats.leads}
              </p>
              <p className="mt-2 text-[0.8rem] text-[var(--adv-slate)]">Active in your book</p>
            </div>
          </Bezel>
          <Bezel>
            <div className="p-5 md:p-6">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adv-slate)]">
                Members
              </p>
              <p className="adv-display text-[clamp(1.75rem,3vw,2.15rem)] font-semibold leading-none tracking-[-0.03em] text-[var(--adv-ink)]">
                {stats.members}
              </p>
              <p className="mt-2 text-[0.8rem] text-[var(--adv-slate)]">Enrolled under you</p>
            </div>
          </Bezel>
        </div>

        <div className="adv-reveal">
          <Bezel>
            <div className="p-5 md:p-6">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="adv-display text-xl font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                  Recent activity
                </h2>
                <Link
                  href="/engagement"
                  className="text-[0.8rem] font-semibold text-[var(--adv-teal)] hover:opacity-80"
                >
                  See all
                </Link>
              </div>

              {recentActivity.length === 0 ? (
                <div className="py-8 text-center">
                  <ChatCircle
                    weight="light"
                    className="mx-auto mb-3 h-10 w-10 text-[var(--adv-slate)]/40"
                    aria-hidden
                  />
                  <p className="text-[var(--adv-slate)]">No recent activity</p>
                  <p className="mt-1 text-sm text-[var(--adv-slate)]/80">
                    Start engaging with your contacts to see activity here.
                  </p>
                </div>
              ) : (
                recentActivity.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 border-b border-[rgba(28,25,23,0.06)] py-3.5 last:border-0"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.85rem] bg-[var(--adv-sage-soft)] text-[var(--adv-sage)]">
                      <ActivityIcon type={event.event_type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.875rem] font-semibold capitalize text-[var(--adv-ink)]">
                        {event.event_type}
                        {event.channel ? ` via ${event.channel}` : ''}
                      </p>
                      {event.subject && (
                        <p className="truncate text-[0.75rem] text-[var(--adv-slate)]">
                          {event.subject}
                        </p>
                      )}
                      <p className="mt-0.5 text-[0.7rem] text-[var(--adv-slate)]/80">
                        {new Date(event.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Bezel>
        </div>
      </div>
    </div>
  );
}
