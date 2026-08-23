/**
 * RP-9 — one voice for live "a teammate changed this" infos.
 */
import { describe, expect, it } from 'vitest';
import { teammateUpdated } from './live-record-copy';

describe('teammateUpdated (RP-9)', () => {
  it('record-level update keeps the user informed whether their edits were kept', () => {
    expect(teammateUpdated('crm_records', { keptEdits: true })).toEqual({
      title: 'A teammate updated this record',
      description: 'Your unsaved edits were kept. Reload when you are ready.',
      duration: 4000,
    });
    expect(teammateUpdated('crm_records')).toEqual({
      title: 'A teammate updated this record',
      description: 'Their changes are loading now.',
      duration: 3000,
    });
  });

  it('dependent tables are short "A teammate …" nudges with no description', () => {
    expect(teammateUpdated('crm_notes')).toEqual({ title: 'A teammate added a note', duration: 2500 });
    expect(teammateUpdated('crm_attachments').title).toBe('A teammate uploaded a file');
    expect(teammateUpdated('crm_stage_history').title).toBe('A teammate updated the stage');
    expect(teammateUpdated('something_else').title).toBe('A teammate updated this record');
    for (const t of ['crm_notes', 'crm_tasks', 'crm_attachments', 'crm_stage_history', 'crm_audit_logs', 'x']) {
      expect(teammateUpdated(t).title.startsWith('A teammate ')).toBe(true);
      expect(teammateUpdated(t).title.endsWith('.')).toBe(false);
    }
  });
});
