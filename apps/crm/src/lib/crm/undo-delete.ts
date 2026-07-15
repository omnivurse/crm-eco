'use client';

import { toast } from 'sonner';

/**
 * Client helpers for the CRM undo-delete flow (Phase 1: records).
 *
 * Deleting a record soft-deletes it and returns a trash `batchId`. These helpers
 * turn that into a Gmail-style "Moved to Trash · Undo" toast and the restore call.
 */

/** Restore every record in a trash batch (the Undo action). */
export async function restoreTrashBatch(batchId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/crm/records/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ batch_id: batchId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface DeletedToastOptions {
  /** Trash batch id from the delete response; without it, no Undo is offered. */
  batchId: string | null | undefined;
  /** Number of records deleted (drives copy + restored count). */
  count?: number;
  /** Called after a successful Undo (e.g. to refetch the list). */
  onUndo?: () => void;
}

/**
 * Show a "Moved to Trash" success toast with an 8s Undo action that restores the
 * batch. Falls back to a plain success toast if there is no batch id.
 */
export function toastDeletedWithUndo({ batchId, count = 1, onUndo }: DeletedToastOptions) {
  const message = count > 1 ? `${count} records moved to Trash` : 'Moved to Trash';

  if (!batchId) {
    toast.success(message);
    return;
  }

  toast.success(message, {
    duration: 8000,
    action: {
      label: 'Undo',
      onClick: async () => {
        const ok = await restoreTrashBatch(batchId);
        if (ok) {
          toast.success(count > 1 ? `${count} records restored` : 'Record restored');
          onUndo?.();
        } else {
          toast.error('Could not restore — open Trash to recover it.');
        }
      },
    },
  });
}

// ── Phase 2: child entities (tasks, notes, sticky notes, attachments) ────────

export type TrashItemEntity =
  | 'task'
  | 'note'
  | 'sticky_note'
  | 'attachment'
  | 'record_link'
  | 'contact_group'
  | 'saved_view'
  | 'carrier_contact';

/** Restore a single soft-deleted child entity (the Undo action). */
export async function restoreTrashItem(entity: TrashItemEntity, id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/crm/trash/restore-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ entity, id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ItemDeletedToastOptions {
  entity: TrashItemEntity;
  id: string;
  /** Human label for the toast, e.g. "Task", "Note", "Attachment". */
  label?: string;
  /** Called after a successful Undo (e.g. to refetch). */
  onUndo?: () => void;
}

/** "<Label> deleted · Undo" toast that restores one child entity on Undo. */
export function toastItemDeletedWithUndo({ entity, id, label, onUndo }: ItemDeletedToastOptions) {
  const noun = label ?? 'Item';
  toast.success(`${noun} deleted`, {
    duration: 8000,
    action: {
      label: 'Undo',
      onClick: async () => {
        const ok = await restoreTrashItem(entity, id);
        if (ok) {
          toast.success(`${noun} restored`);
          onUndo?.();
        } else {
          toast.error(`Could not restore the ${noun.toLowerCase()}.`);
        }
      },
    },
  });
}
