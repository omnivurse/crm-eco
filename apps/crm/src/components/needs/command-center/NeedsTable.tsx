'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  const containerRef = useRef<HTMLDivElement>(null);

  const ROW_HEIGHT = 72; // Estimated row height
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual returns mutable virtualizer by design
  const rowVirtualizer = useVirtualizer({
    count: needs.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

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
        <div ref={containerRef} className="overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white">
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
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
                display: 'block',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const need = needs[virtualRow.index];
                return (
                  <TableRow
                    key={need.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="hover:bg-slate-50 flex"
                  >
                    <TableCell className="flex-1">
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
                    <TableCell className="flex-1">
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
                    <TableCell className="flex-1">
                      {need.assigned_to_name ? (
                        <span className="text-sm text-slate-700">{need.assigned_to_name}</span>
                      ) : (
                        <span className="text-sm text-slate-400 italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="flex-1">
                      <NeedStatusBadge status={need.status} />
                    </TableCell>
                    <TableCell className="flex-1">
                      <UrgencyBadge urgency={need.urgency_light} />
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 flex-1">
                      {need.sla_target_date
                        ? format(new Date(need.sla_target_date), 'MMM d, yyyy')
                        : <span className="text-slate-400">—</span>
                      }
                    </TableCell>
                    <TableCell className="flex-1">
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
                    <TableCell className="flex-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${need.iua_met
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-600'
                        }`}>
                        {need.iua_met ? 'Yes' : 'No'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 flex-1">
                      {format(new Date(need.updated_at), 'MMM d')}
                    </TableCell>
                    <TableCell className="w-12 flex-shrink-0">
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

