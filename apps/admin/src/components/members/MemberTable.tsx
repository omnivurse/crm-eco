'use client';

import { Badge, Button } from '@crm-eco/ui';
import { Eye, Users } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  state: string | null;
  plan_name: string | null;
  effective_date: string | null;
  created_at: string;
  advisor: { id: string; first_name: string; last_name: string } | null;
}

interface MemberTableProps {
  members: Member[];
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
    <div className="overflow-x-auto">
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
  );
}
