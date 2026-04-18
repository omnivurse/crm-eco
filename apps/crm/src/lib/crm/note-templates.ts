/**
 * CRM Note Templates
 *
 * A small catalog of built-in note templates used by the V2 record detail
 * "Note Template" split button. Until a proper `crm_note_templates` table
 * ships (planned for PR 5 customization), these are static client-side
 * defaults so users get a real template picker instead of a disabled stub.
 *
 * Templates support `{{token}}` placeholders. `renderNoteTemplate` fills
 * them from the record's known fields (title, email, phone, owner) and
 * from the current date. Unknown tokens are left as-is so nothing silently
 * disappears.
 */

export interface CrmNoteTemplate {
  id: string;
  label: string;
  /** Short helper text shown beneath the label in the picker. */
  description?: string;
  /** Body with optional `{{token}}` merge fields. */
  body: string;
  /** Optional category grouping in the picker. */
  category?: 'call' | 'meeting' | 'followup' | 'general';
}

/** Built-in catalog. Ordered as they should appear in the picker. */
export const DEFAULT_NOTE_TEMPLATES: CrmNoteTemplate[] = [
  {
    id: 'discovery-call',
    label: 'Discovery Call',
    description: 'Intro conversation with a new contact',
    category: 'call',
    body: [
      'Discovery call with {{name}} on {{today}}.',
      '',
      'Current situation:',
      '- ',
      '',
      'Pain points / goals:',
      '- ',
      '',
      'Next step: ',
    ].join('\n'),
  },
  {
    id: 'voicemail-left',
    label: 'Voicemail Left',
    description: 'Quick log for an unanswered call',
    category: 'call',
    body: 'Called {{name}} at {{phone}} on {{today}} — left voicemail. Will follow up in 2 business days.',
  },
  {
    id: 'no-answer',
    label: 'No Answer',
    description: 'Attempted to reach but no response',
    category: 'call',
    body: 'Attempted to reach {{name}} at {{phone}} on {{today}} — no answer, no voicemail option. Retry tomorrow.',
  },
  {
    id: 'meeting-recap',
    label: 'Meeting Recap',
    description: 'Summary of a scheduled meeting',
    category: 'meeting',
    body: [
      'Meeting with {{name}} on {{today}}.',
      '',
      'Attendees:',
      '- ',
      '',
      'Key discussion points:',
      '- ',
      '',
      'Agreed next steps:',
      '- ',
      '',
      'Follow-up owner: {{owner}}',
    ].join('\n'),
  },
  {
    id: 'follow-up-required',
    label: 'Follow-up Required',
    description: 'Flag the record for a future touch',
    category: 'followup',
    body:
      'Follow-up needed with {{name}}. Last touched on {{today}}. Next action: reach out within 3 business days.',
  },
  {
    id: 'information-sent',
    label: 'Information Sent',
    description: 'Sent collateral/proposal/etc.',
    category: 'followup',
    body:
      'Sent information to {{name}} at {{email}} on {{today}}. Will circle back if no reply by end of week.',
  },
  {
    id: 'closed-won',
    label: 'Closed — Won',
    description: 'Mark a successful outcome',
    category: 'general',
    body:
      'Closed won with {{name}} on {{today}}. Handoff to onboarding / account management underway.',
  },
  {
    id: 'closed-lost',
    label: 'Closed — Lost',
    description: 'Mark a disqualified outcome',
    category: 'general',
    body:
      'Closed lost with {{name}} on {{today}}. Reason: [competitor/budget/timing/other]. Re-engage in [6 months].',
  },
];

export interface NoteTemplateContext {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  owner?: string | null;
}

/**
 * Replace `{{token}}` placeholders. Unknown tokens are left as-is so copy
 * never looks broken ("Hi {{contact_name}}" is preferable to "Hi " if the
 * lookup fails).
 */
export function renderNoteTemplate(
  template: CrmNoteTemplate,
  ctx: NoteTemplateContext,
): string {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const values: Record<string, string> = {
    name: ctx.name?.trim() || 'this contact',
    email: ctx.email?.trim() || '—',
    phone: ctx.phone?.trim() || '—',
    owner: ctx.owner?.trim() || 'unassigned',
    today,
  };

  return template.body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
    const val = values[key as keyof typeof values];
    return val === undefined ? match : val;
  });
}
