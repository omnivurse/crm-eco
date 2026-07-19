import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  applyActiveCrmLeadsFilters,
  crmRecordToLeadListItem,
  resolveLeadsModuleId,
} from '@crm-eco/lib';
import Link from 'next/link';
import {
  Users,
  Phone,
  Envelope,
  CaretRight,
  MagnifyingGlass,
} from '@phosphor-icons/react/dist/ssr';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

export const dynamic = 'force-dynamic';

interface ContactRecord {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
    created_at: string;
}

async function getContacts(organizationId: string, advisorId: string) {
    const supabase = await createServerSupabaseClient();
    const leadsModuleId = await resolveLeadsModuleId(supabase, organizationId);

    let leads: ContactRecord[] = [];
    if (leadsModuleId) {
        const { data: leadRows } = await (applyActiveCrmLeadsFilters(
            (supabase as any)
                .from('crm_records')
                .select('id, email, phone, status, created_at, data')
                .eq('org_id', organizationId)
                .eq('module_id', leadsModuleId)
                .eq('advisor_id', advisorId),
            organizationId,
            leadsModuleId,
        )
            .order('created_at', { ascending: false })
            .limit(50) as Promise<{ data: Array<{
                id: string;
                email: string | null;
                phone: string | null;
                status: string | null;
                created_at: string | null;
                data: unknown;
            }> | null }>);

        leads = (leadRows ?? []).map((row) => {
            const item = crmRecordToLeadListItem({
                ...row,
                data: row.data as import('@crm-eco/lib/types').Json | null,
            });
            return {
                id: item.id,
                first_name: item.first_name,
                last_name: item.last_name,
                email: item.email,
                phone: item.phone,
                status: item.status,
                created_at: item.created_at ?? new Date(0).toISOString(),
            };
        });
    }

    const { data: members } = await (supabase as any)
        .from('members')
        .select('id, first_name, last_name, email, phone, status, created_at')
        .eq('organization_id', organizationId)
        .eq('advisor_id', advisorId)
        .order('created_at', { ascending: false })
        .limit(50) as { data: ContactRecord[] | null };

    return {
        leads,
        members: members || [],
    };
}

async function getCurrentAdvisorInfo() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, advisor_id, organization_id')
        .eq('user_id', user.id)
        .single();

    return profile;
}

export default async function ContactsPage() {
    const advisorInfo = await getCurrentAdvisorInfo();

    if (!advisorInfo?.advisor_id || !advisorInfo?.organization_id) {
        return (
            <div className="flex h-64 items-center justify-center">
                <p className="text-[var(--adv-slate)]">Unable to load contacts.</p>
            </div>
        );
    }

    const { leads, members } = await getContacts(
        advisorInfo.organization_id,
        advisorInfo.advisor_id
    );

    const allContacts = [
        ...leads.map((l) => ({ ...l, type: 'lead' as const })),
        ...members.map((m) => ({ ...m, type: 'member' as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
        <div className="space-y-6">
            <PageHeader
                kicker="Book of business"
                title="Contacts"
                description={`${leads.length} leads, ${members.length} members`}
            />

            <div className="relative">
                <MagnifyingGlass
                    weight="light"
                    className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--adv-slate)]"
                    aria-hidden
                />
                <input
                    type="text"
                    placeholder="Search contacts..."
                    className="w-full rounded-[0.85rem] border border-[rgba(28,25,23,0.1)] bg-white py-2.5 pl-11 pr-4 text-[var(--adv-ink)] placeholder:text-[var(--adv-slate)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--adv-teal)]/30"
                />
            </div>

            <Bezel>
                <div className="overflow-hidden">
                    {allContacts.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users
                                weight="light"
                                className="mx-auto mb-4 h-12 w-12 text-[var(--adv-slate)]/40"
                                aria-hidden
                            />
                            <h3 className="adv-display mb-2 text-lg font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
                                No contacts yet
                            </h3>
                            <p className="mx-auto max-w-sm text-[var(--adv-slate)]">
                                Contacts assigned to you will appear here. Ask your administrator to assign leads or members.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[rgba(28,25,23,0.06)]">
                            {allContacts.map((contact) => (
                                <Link
                                    key={`${contact.type}-${contact.id}`}
                                    href={`/contacts/${contact.type}/${contact.id}`}
                                    className="flex items-center gap-4 p-4 transition-colors hover:bg-[rgba(11,109,133,0.04)]"
                                >
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.85rem] bg-[var(--adv-sage-soft)]">
                                        <span className="font-medium text-[var(--adv-teal)]">
                                            {contact.first_name?.charAt(0) || '?'}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate font-medium text-[var(--adv-ink)]">
                                                {contact.first_name} {contact.last_name}
                                            </p>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    contact.type === 'member'
                                                        ? 'bg-[var(--adv-sage-soft)] text-[var(--adv-sage)]'
                                                        : 'bg-[rgba(11,109,133,0.1)] text-[var(--adv-teal)]'
                                                }`}
                                            >
                                                {contact.type}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-4 text-sm text-[var(--adv-slate)]">
                                            {contact.email && (
                                                <span className="flex items-center gap-1 truncate">
                                                    <Envelope weight="light" className="h-3.5 w-3.5" aria-hidden />
                                                    {contact.email}
                                                </span>
                                            )}
                                            {contact.phone && (
                                                <span className="flex items-center gap-1">
                                                    <Phone weight="light" className="h-3.5 w-3.5" aria-hidden />
                                                    {contact.phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <CaretRight
                                        weight="light"
                                        className="h-5 w-5 text-[var(--adv-slate)]/50"
                                        aria-hidden
                                    />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </Bezel>
        </div>
    );
}
