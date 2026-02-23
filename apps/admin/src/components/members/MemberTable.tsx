'use client';

import { Badge, Button } from '@crm-eco/ui';
import { Eye, Users, Mail, Phone, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Member as MemberRow } from '@crm-eco/lib/types';

/** Member row with joined advisor relation, as returned by the list query */
type MemberWithAdvisor = Pick<MemberRow, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'status' | 'state' | 'plan_name' | 'effective_date'> & {
  created_at: string;
  advisor: { id: string; first_name: string; last_name: string } | null;
};

interface MemberTableProps {
  members: MemberWithAdvisor[];
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
function MemberCard({ member }: { member: MemberWithAdvisor }) {
  return (
    <Link
      href={`/members/${member.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow active:scale-[0.99]"
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
  );
}

export function MemberTable({ members }: MemberTableProps) {
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

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-medium text-slate-500 text-sm">Name</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Email</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Phone</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">State</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Plan</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Agent</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Created</th>
              <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b hover:bg-slate-50">
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
                    `${member.advisor.first_name} ${member.advisor.last_name}`
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
    </>
  );
}
