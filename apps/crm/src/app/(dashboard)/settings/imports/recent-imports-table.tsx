'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@crm-eco/ui';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import type { ImportJob } from '@crm-eco/lib/types';
import { FileSpreadsheet } from 'lucide-react';

interface RecentImportsTableProps {
  imports: ImportJob[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const entityTypeLabels: Record<string, string> = {
  member: 'Members',
  advisor: 'Advisors',
  lead: 'Leads',
};

export function RecentImportsTable({ imports }: RecentImportsTableProps) {
  if (imports.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="font-medium">No imports yet</p>
        <p className="text-sm text-slate-400 mt-1">
          Upload a CSV file above to get started
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Entity Type</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>File</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {imports.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="text-slate-500 text-sm">
              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
            </TableCell>
            <TableCell className="font-medium">
              {entityTypeLabels[job.entity_type] || job.entity_type}
            </TableCell>
            <TableCell className="text-slate-500">
              {job.source_name || '—'}
            </TableCell>
            <TableCell className="text-slate-500 text-sm truncate max-w-[150px]">
              {job.file_name || '—'}
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={statusColors[job.status] || 'bg-slate-100 text-slate-700'}
              >
                {job.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/settings/imports/${job.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {job.processed_rows} / {job.total_rows}
                {job.error_count > 0 && (
                  <span className="text-red-500 ml-1">
                    ({job.error_count} errors)
                  </span>
                )}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

