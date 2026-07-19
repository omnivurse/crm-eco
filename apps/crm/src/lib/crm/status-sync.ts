/**
 * Canonical operational status lives on `crm_records.status`.
 * JSONB `lead_status` / `contact_status` are mirrors kept in sync so forms
 * and remirrors cannot resurrect a stale value after Kanban/list/bulk writes.
 */

export type CrmStatusJsonbKey = 'lead_status' | 'contact_status';

/** JSONB status field for a module. Leads use lead_status; everyone else uses contact_status. */
export function statusJsonbFieldKey(
  moduleKey: string | null | undefined,
): CrmStatusJsonbKey {
  return moduleKey === 'leads' ? 'lead_status' : 'contact_status';
}

/**
 * Apply a status change to a row update payload: set the indexed column and
 * mirror into the module's JSONB status key (preserving other data keys).
 */
export function applyStatusToRecordUpdates(
  updates: Record<string, unknown>,
  status: string | null,
  moduleKey: string | null | undefined,
  previousData: Record<string, unknown> | null | undefined,
): void {
  updates.status = status;
  const key = statusJsonbFieldKey(moduleKey);
  const base =
    updates.data && typeof updates.data === 'object' && !Array.isArray(updates.data)
      ? { ...(updates.data as Record<string, unknown>) }
      : previousData && typeof previousData === 'object' && !Array.isArray(previousData)
        ? { ...previousData }
        : {};
  base[key] = status;
  // Contacts/members: never leave a competing lead_status that remirror logic
  // or forms could treat as live after conversion.
  if (moduleKey === 'contacts' || moduleKey === 'members') {
    delete base.lead_status;
  }
  updates.data = base;
}

/** True when a JSONB patch intentionally changes a status-related key. */
export function patchTouchesStatus(patch: Record<string, unknown>): boolean {
  return (
    patch.status !== undefined ||
    patch.lead_status !== undefined ||
    patch.contact_status !== undefined
  );
}
