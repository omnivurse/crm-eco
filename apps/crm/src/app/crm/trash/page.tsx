import { Trash2 } from 'lucide-react';
import { TrashClient } from './TrashClient';

export const dynamic = 'force-dynamic';

/**
 * CRM Recycle Bin — a unified Trash console across every soft-deletable entity
 * (records, tasks, notes, attachments, record links, contact groups, carrier
 * contacts, plus the admin's own sticky notes and saved views). Admins/managers
 * restore or permanently delete. Access is enforced by the underlying
 * /api/crm/trash + restore endpoints (crm_admin / crm_manager).
 */
export default function CrmTrashPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/5">
          <Trash2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Trash</h1>
          <p className="text-sm text-slate-500">
            Deleted records, tasks, notes, attachments and more are kept for 30 days. Restore them,
            or delete them permanently.
          </p>
        </div>
      </div>
      <TrashClient />
    </div>
  );
}
