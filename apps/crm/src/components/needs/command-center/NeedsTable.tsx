'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Card,
  CardContent,
} from '@crm-eco/ui';
import { HeartPulse } from 'lucide-react';
import { type NeedStatus, getNeedStatusLabel } from '@crm-eco/lib';
import { NeedStatusBadge } from '@/components/shared/status-badge';
import { UrgencyBadge } from '@/components/shared/urgency-badge';
import { NeedActionsMenu } from './NeedActionsMenu';
import type { AssignableProfile } from '@/app/crm/needs/command-center/page';

export interface NeedWithMember {
  id: string;
  status: NeedStatus;
  urgency_light: 'green' | 'orange' | 'red' | null;
  sla_target_date: string | null;
  need_type: string;
  description: string | null;
  billed_amount: number | null;
  approved_amount: number | null;
  member_responsibility_amount: number | null;
  eligible_amount: number | null;
  reimbursed_amount: number | null;
  iua_met: boolean;
  updated_at: string;
  created_at: string;
  member_id: string | null;
  member_first_name: string | null;
  member_last_name: string | null;
  assigned_to_profile_id: string | null;
  assigned_to_name: string | null;
}

interface NeedsTableProps {
  needs: NeedWithMember[];
  assignableProfiles: AssignableProfile[];
  currentProfileId: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function NeedsTable({ needs, assignableProfiles, currentProfileId }: NeedsTableProps) {
  if (needs.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HeartPulse className="w-8 h-8 text-slate-400" />
            </div>
            <p className="font-medium text-slate-700 mb-2">No needs match your filters</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Try adjusting your filters or search criteria.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Need</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Target Date</TableHead>
              <TableHead>Amounts</TableHead>
              <TableHead>IUA Met</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {needs.map((need) => (
              <TableRow key={need.id} className="hover:bg-slate-50">
                <TableCell>
                  {need.member_id ? (
                    <Link 
                      href={`/members/${need.member_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {need.member_first_name} {need.member_last_name}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="max-w-[200px]">
                    <p className="font-medium text-slate-900 truncate">
                      {need.need_type.replace(/_/g, ' ')}
                    </p>
                    {need.description && (
                      <p className="text-xs text-slate-500 truncate">
                        {need.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {need.assigned_to_name ? (
                    <span className="text-sm text-slate-700">{need.assigned_to_name}</span>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <NeedStatusBadge status={need.status} />
                </TableCell>
                <TableCell>
                  <UrgencyBadge urgency={need.urgency_light} />
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {need.sla_target_date 
                    ? format(new Date(need.sla_target_date), 'MMM d, yyyy')
                    : <span className="text-slate-400">—</span>
                  }
                </TableCell>
                <TableCell>
                  <div className="text-xs space-y-0.5">
                    <div className="text-slate-600">
                      <span className="text-slate-400">Billed:</span>{' '}
                      {formatCurrency(need.billed_amount)}
                    </div>
                    <div className="text-slate-600">
                      <span className="text-slate-400">Approved:</span>{' '}
                      {formatCurrency(need.approved_amount || need.eligible_amount)}
                    </div>
                    <div className="text-slate-600">
                      <span className="text-slate-400">Member:</span>{' '}
                      {formatCurrency(need.member_responsibility_amount)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    need.iua_met 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {need.iua_met ? 'Yes' : 'No'}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {format(new Date(need.updated_at), 'MMM d')}
                </TableCell>
                <TableCell>
                  <NeedActionsMenu
                    needId={need.id}
                    currentStatus={need.status}
                    currentTargetDate={need.sla_target_date}
                    currentIuaMet={need.iua_met}
                    assignableProfiles={assignableProfiles}
                    currentProfileId={currentProfileId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

