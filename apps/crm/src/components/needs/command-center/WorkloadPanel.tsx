'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from '@crm-eco/ui';
import { Users, X } from 'lucide-react';
import type { WorkloadBucket } from '@/app/crm/needs/command-center/page';

interface WorkloadPanelProps {
  workload: WorkloadBucket[];
  selectedAssigneeId: string | 'all';
  onSelectAssignee: (assigneeId: string | 'all') => void;
}

export function WorkloadPanel({ 
  workload, 
  selectedAssigneeId, 
  onSelectAssignee 
}: WorkloadPanelProps) {
  if (workload.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-slate-500" />
            Ops Workload (Open Needs)
          </CardTitle>
          {selectedAssigneeId !== 'all' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSelectAssignee('all')}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-4 h-4 mr-1" />
              Clear filter
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assignee</TableHead>
              <TableHead className="text-right w-20">Total</TableHead>
              <TableHead className="text-right w-24">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  On Track
                </span>
              </TableHead>
              <TableHead className="text-right w-20">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  At-Risk
                </span>
              </TableHead>
              <TableHead className="text-right w-20">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Overdue
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workload.map((bucket) => {
              const isSelected = selectedAssigneeId === bucket.profileId;
              return (
                <TableRow 
                  key={bucket.profileId}
                  onClick={() => onSelectAssignee(bucket.profileId)}
                  className={`
                    cursor-pointer transition-colors
                    ${isSelected 
                      ? 'bg-blue-50 hover:bg-blue-100' 
                      : 'hover:bg-slate-50'
                    }
                  `}
                >
                  <TableCell className="font-medium">
                    <span className={bucket.profileId === 'unassigned' ? 'text-slate-400 italic' : ''}>
                      {bucket.name}
                    </span>
                    {isSelected && (
                      <span className="ml-2 text-xs text-blue-600">(filtered)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {bucket.total}
                  </TableCell>
                  <TableCell className="text-right text-emerald-700">
                    {bucket.green}
                  </TableCell>
                  <TableCell className="text-right text-amber-700">
                    {bucket.orange}
                  </TableCell>
                  <TableCell className="text-right text-red-700">
                    {bucket.red}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

