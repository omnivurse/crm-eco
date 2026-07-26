'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@crm-eco/ui';
import { updateAdminTicketStatus } from '../actions';

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting on member' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function AdminTicketStatusForm({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="ticket-status" className="text-xs text-slate-500">
        Status
      </Label>
      <select
        id="ticket-status"
        className="h-8 rounded-md border border-slate-200 bg-transparent px-2 text-sm dark:border-white/10"
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await updateAdminTicketStatus({ ticketId, status: next });
            router.refresh();
          });
        }}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
