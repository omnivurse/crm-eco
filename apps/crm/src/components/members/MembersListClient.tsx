'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@crm-eco/ui';
import {
  Users,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { MembersSummaryCards, type MemberStats } from './MembersSummaryCards';
import type { Member as CanonicalMember, Advisor as CanonicalAdvisor } from '@crm-eco/lib/types';

type Member = Pick<CanonicalMember, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'status' | 'state' | 'plan_name' | 'effective_date' | 'termination_date' | 'created_at'> & {
  advisor: Pick<CanonicalAdvisor, 'id' | 'first_name' | 'last_name'> | null;
};

function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'pending':
    case 'prospect':
      return 'secondary';
    case 'inactive':
    case 'terminated':
      return 'destructive';
    case 'paused':
      return 'outline';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function MemberCard({ member }: { member: Member }) {
  return (
    <Link
      href={`/crm/r/${member.id}`}
      className="block bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/50 p-4 hover:shadow-md transition-shadow active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
            {member.first_name} {member.last_name}
          </h3>
          <Badge
            variant={getStatusBadgeVariant(member.status)}
            className="mt-1"
          >
            {getStatusLabel(member.status)}
          </Badge>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Mail className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="truncate">{member.email}</span>
        </div>
        {member.phone && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Phone className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
            <span>{member.phone}</span>
          </div>
        )}
        {member.state && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
            <span>{member.state}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <span>{member.plan_name || 'No plan'}</span>
        <span>{member.created_at ? formatDate(member.created_at) : '—'}</span>
      </div>
    </Link>
  );
}

function MemberTableRow({ member }: { member: Member }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="py-3 pr-4">
        <Link
          href={`/crm/r/${member.id}`}
          className="text-sm font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
        >
          {member.first_name} {member.last_name}
        </Link>
      </td>
      <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">
        {member.email}
      </td>
      <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">
        {member.phone || (
          <span className="text-slate-300 dark:text-slate-600">&mdash;</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">
        {member.state || (
          <span className="text-slate-300 dark:text-slate-600">&mdash;</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">
        {member.plan_name || (
          <span className="text-slate-300 dark:text-slate-600">&mdash;</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-400">
        {member.advisor ? (
          `${member.advisor.first_name} ${member.advisor.last_name}`
        ) : (
          <span className="text-slate-300 dark:text-slate-600">&mdash;</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <Badge variant={getStatusBadgeVariant(member.status)}>
          {getStatusLabel(member.status)}
        </Badge>
      </td>
      <td className="py-3 text-sm text-slate-500 dark:text-slate-400">
        {member.created_at ? formatDate(member.created_at) : '—'}
      </td>
    </tr>
  );
}

export function MembersListClient() {
  const [stats, setStats] = useState<MemberStats>({
    total: 0,
    active: 0,
    inactive: 0,
    futureActive: 0,
    futureInactive: 0,
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch stats on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/members/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch member stats:', err);
      }
    }
    fetchStats();
  }, []);

  // Fetch members when filter changes
  const fetchMembers = useCallback(async (filter: string | null) => {
    setMembersLoading(true);
    try {
      const url = filter
        ? `/api/members?status=${filter}`
        : '/api/members';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setMembersLoading(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers(activeFilter);
  }, [activeFilter, fetchMembers]);

  const handleFilterChange = (filter: string | null) => {
    setActiveFilter(filter);
  };

  // Client-side search filtering
  const filteredMembers = search
    ? members.filter((m) => {
        const term = search.toLowerCase();
        return (
          m.first_name.toLowerCase().includes(term) ||
          m.last_name.toLowerCase().includes(term) ||
          m.email.toLowerCase().includes(term) ||
          (m.phone && m.phone.includes(term)) ||
          (m.state && m.state.toLowerCase().includes(term))
        );
      })
    : members;

  const filterLabels: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    futureActive: 'Future Active',
    futureInactive: 'Future Inactive',
    healthshare: 'Healthshare',
    insurance: 'Insurance',
    medicaid: 'Medicaid',
    short_term: 'Short-Term',
  };
  const filterLabel = activeFilter ? (filterLabels[activeFilter] ?? 'All') : 'All';

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <MembersSummaryCards
        stats={stats}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />

      {/* Members List */}
      <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {filterLabel} Members
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {loading
                  ? 'Loading...'
                  : `${filteredMembers.length} member${filteredMembers.length !== 1 ? 's' : ''} found`}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0891b2]/50 focus:border-[#0891b2] w-full sm:w-64"
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading || membersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">
                Loading members...
              </span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                {search
                  ? 'No members match your search'
                  : 'No members found'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredMembers.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                      <th className="pb-3 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        Name
                      </th>
                      <th className="pb-3 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        Email
                      </th>
                      <th className="pb-3 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        Phone
                      </th>
                      <th className="pb-3 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        State
                      </th>
                      <th className="pb-3 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        Plan
                      </th>
                      <th className="pb-3 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        Agent
                      </th>
                      <th className="pb-3 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        Status
                      </th>
                      <th className="pb-3 font-medium text-slate-500 dark:text-slate-400 text-sm">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <MemberTableRow key={member.id} member={member} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
