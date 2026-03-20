'use client';

import { useState, useCallback } from 'react';
import { Badge, Button, Checkbox } from '@crm-eco/ui';
import { Eye, Users, Mail, Phone, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { Member as MemberRow } from '@crm-eco/lib/types';
import { BulkAssignBar } from './BulkAssignBar';

/** Member row with joined advisor relation, as returned by the list query */
type MemberWithAdvisor = Pick<MemberRow, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'status' | 'state' | 'plan_name' | 'effective_date'> & {
  created_at: string;
  market_type?: string | null;
  advisor: { id: string; first_name: string; last_name: string } | null;
};

interface MemberTableProps {
  members: MemberWithAdvisor[];
  orgId: string;
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'inactive':
    case 'terminated':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'terminated':
      return 'Terminated';
    default:
      return status;
  }
}

/**
 * Mobile card component for displaying a member.
 */
function MemberCard({
  member,
  selected,
  onToggle,
}: {
  member: MemberWithAdvisor;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="relative bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
      {/* Selection checkbox */}
      <div
        className="absolute left-3 top-4 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(member.id)}
          aria-label={`Select ${member.first_name} ${member.last_name}`}
        />
      </div>

      <Link
        href={`/members/${member.id}`}
        className="block p-4 pl-10 active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">
              {member.first_name} {member.last_name}
            </h3>
            <Badge variant={getStatusBadgeVariant(member.status)} className="mt-1">
              {getStatusLabel(member.status)}
            </Badge>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span className="truncate">{member.email}</span>
          </div>
          {member.phone && (
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 flex-shrink-0 text-slate-400" />
              <span>{member.phone}</span>
            </div>
          )}
          {member.state && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" />
              <span>{member.state}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>{member.plan_name || 'No plan'}</span>
          <span>{format(new Date(member.created_at), 'MMM d, yyyy')}</span>
        </div>
      </Link>
    </div>
  );
}

export function MemberTable({ members, orgId }: MemberTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allIds = members.map((m) => m.id);
  const allSelected = members.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id)) && !allSelected;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (allIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...allIds]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allIds)]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAssignComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">No members found</p>
        <Link href="/members/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
          Add your first member
        </Link>
      </div>
    );
  }

  const selectedArray = Array.from(selectedIds);

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            selected={selectedIds.has(member.id)}
            onToggle={toggleOne}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 pl-1 pr-3 w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all members"
                />
              </th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Name</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Email</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Phone</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">State</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Plan</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Advisor</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Created</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className={`border-b hover:bg-slate-50 ${selectedIds.has(member.id) ? 'bg-primary/5' : ''}`}
              >
                <td className="py-3 pl-1 pr-3">
                  <Checkbox
                    checked={selectedIds.has(member.id)}
                    onCheckedChange={() => toggleOne(member.id)}
                    aria-label={`Select ${member.first_name} ${member.last_name}`}
                  />
                </td>
                <td className="py-3">
                  <p className="text-sm font-medium">
                    {member.first_name} {member.last_name}
                  </p>
                </td>
                <td className="py-3 text-sm">{member.email}</td>
                <td className="py-3 text-sm">
                  {member.phone || <span className="text-slate-400">—</span>}
                </td>
                <td className="py-3 text-sm">
                  {member.state || <span className="text-slate-400">—</span>}
                </td>
                <td className="py-3 text-sm">
                  {member.plan_name || <span className="text-slate-400">—</span>}
                </td>
                <td className="py-3 text-sm">
                  {member.advisor ? (
                    <span className="inline-flex items-center gap-1.5">
                      {member.market_type === 'healthshare' && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 font-medium bg-emerald-100 text-emerald-700 border-emerald-200">
                          Advisor
                        </Badge>
                      )}
                      {member.market_type === 'traditional_insurance' && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 font-medium bg-blue-100 text-blue-700 border-blue-200">
                          Agent
                        </Badge>
                      )}
                      {member.advisor.first_name} {member.advisor.last_name}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3">
                  <Badge variant={getStatusBadgeVariant(member.status)}>
                    {getStatusLabel(member.status)}
                  </Badge>
                </td>
                <td className="py-3 text-sm text-slate-500">
                  {format(new Date(member.created_at), 'MMM d, yyyy')}
                </td>
                <td className="py-3">
                  <Link href={`/members/${member.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Spacer to prevent content from being hidden behind the sticky bar */}
      {selectedArray.length > 0 && <div className="h-16" />}

      {/* Bulk assign bar */}
      <BulkAssignBar
        selectedIds={selectedArray}
        onClearSelection={clearSelection}
        onAssignComplete={handleAssignComplete}
        orgId={orgId}
      />
    </>
  );
}
