'use client';

import { ClipboardText } from '@phosphor-icons/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@crm-eco/ui/components/table';
import type { DocumentAuditEntry } from './types';
import { getActionLabel, formatDateTime } from './utils';

interface AuditLogViewProps {
  entries: DocumentAuditEntry[];
  loading: boolean;
}

export function AuditLogView({ entries, loading }: AuditLogViewProps) {
  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
        <ClipboardText weight="light" className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="w-40">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(entry => (
            <TableRow key={entry.id}>
              <TableCell className="text-sm font-medium">{getActionLabel(entry.action)}</TableCell>
              <TableCell className="text-sm text-gray-600">
                {entry.profiles?.full_name || 'Unknown'}
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {entry.meta && Object.keys(entry.meta).length > 0
                  ? Object.entries(entry.meta)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')
                  : '--'}
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {formatDateTime(entry.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
