/**
 * Live-record toast copy (RP-9) — ONE voice for "a teammate changed this"
 * infos fired by RecordDetailShellV2's `useLiveRecord` handler. Pure + no
 * React so it is unit-testable (the shell itself cannot be imported in
 * vitest: its import graph reaches server-only modules).
 *
 *   teammateUpdated('crm_records')                    → "A teammate updated this record" + "Their changes are loading now."
 *   teammateUpdated('crm_records', { keptEdits: true }) → … + "Your unsaved edits were kept. Reload when you are ready."
 *   teammateUpdated('crm_notes')                      → "A teammate added a note"
 */

export interface TeammateUpdatedToast {
  title: string;
  description?: string;
  /** Sonner duration (ms) — short for nudges, longer when the user must act. */
  duration: number;
}

/** Every wording starts "A teammate …"; titles carry no trailing period. */
export function teammateUpdated(
  table: string,
  opts: { keptEdits?: boolean } = {},
): TeammateUpdatedToast {
  if (table === 'crm_records') {
    return opts.keptEdits
      ? {
          title: 'A teammate updated this record',
          description: 'Your unsaved edits were kept. Reload when you are ready.',
          duration: 4000,
        }
      : {
          title: 'A teammate updated this record',
          description: 'Their changes are loading now.',
          duration: 3000,
        };
  }
  const nudge: Record<string, string> = {
    crm_notes: 'A teammate added a note',
    crm_tasks: 'A teammate updated activities',
    crm_attachments: 'A teammate uploaded a file',
    crm_stage_history: 'A teammate updated the stage',
    crm_audit_logs: 'A teammate updated this record',
  };
  return { title: nudge[table] ?? 'A teammate updated this record', duration: 2500 };
}
