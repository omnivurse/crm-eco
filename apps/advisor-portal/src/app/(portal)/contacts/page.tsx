import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Users, Phone, Mail, ChevronRight, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getContacts(organizationId: string, advisorId: string) {
    const supabase = await createServerSupabaseClient();

    // Fetch leads assigned to this advisor
    const { data: leads } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, phone, status, created_at')
        .eq('organization_id', organizationId)
        .eq('owner_advisor_id', advisorId)
        .order('created_at', { ascending: false })
        .limit(50);

    // Fetch members assigned to this advisor
    const { data: members } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, phone, status, created_at')
        .eq('organization_id', organizationId)
        .eq('advisor_id', advisorId)
        .order('created_at', { ascending: false })
        .limit(50);

    return {
        leads: leads || [],
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
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Unable to load contacts.</p>
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
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Contacts</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {leads.length} leads, {members.length} members
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search contacts..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-advisor-500"
                />
            </div>

            {/* Contacts List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {allContacts.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No contacts yet
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                            Contacts assigned to you will appear here. Ask your administrator to assign leads or members.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {allContacts.map((contact) => (
                            <Link
                                key={`${contact.type}-${contact.id}`}
                                href={`/contacts/${contact.type}/${contact.id}`}
                                className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-advisor-100 dark:bg-advisor-900/30 flex items-center justify-center flex-shrink-0">
                                    <span className="text-advisor-700 dark:text-advisor-400 font-medium">
                                        {contact.first_name?.charAt(0) || '?'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">
                                            {contact.first_name} {contact.last_name}
                                        </p>
                                        <span
                                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${contact.type === 'member'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}
                                        >
                                            {contact.type}
                                        </span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        {contact.email && (
                                            <span className="flex items-center gap-1 truncate">
                                                <Mail className="w-3.5 h-3.5" />
                                                {contact.email}
                                            </span>
                                        )}
                                        {contact.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3.5 h-3.5" />
                                                {contact.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
