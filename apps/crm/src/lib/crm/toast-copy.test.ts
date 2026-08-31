import { describe, it, expect } from 'vitest';
import {
  saved,
  added,
  updated,
  deleted,
  failed,
  sessionExpired,
  toastCopy,
  FAILED_REASON,
  FAILED_REASON_MAX_CHARS,
  MEMBERS_FILLS_FROM_ENROLLMENT,
} from './toast-copy';

describe('toast-copy success templates', () => {
  it('produce one canonical phrasing per outcome', () => {
    expect(saved('Changes')).toBe('Changes saved');
    expect(saved('record')).toBe('Record saved');
    expect(added('Note')).toBe('Note added');
    expect(updated('note')).toBe('Note updated');
    expect(deleted('Task')).toBe('Task deleted');
  });

  it('strip trailing punctuation from the noun', () => {
    expect(added('Note.')).toBe('Note added');
    expect(saved('Changes!')).toBe('Changes saved');
  });

  it('are exposed on the toastCopy bundle', () => {
    expect(toastCopy.added('Note')).toBe('Note added');
    expect(toastCopy.sessionExpired('/crm/x').actionLabel).toBe('Sign in');
  });
});

describe('failed()', () => {
  it('names the action', () => {
    expect(failed('save the note')).toBe("Couldn't save the note.");
  });

  it('adds reason and next step when present', () => {
    expect(failed('save the note', 'name already taken', 'Try again')).toBe(
      "Couldn't save the note — name already taken. Try again.",
    );
    expect(failed('save the note', undefined, 'try again')).toBe(
      "Couldn't save the note. Try again.",
    );
  });

  it('accepts an Error as the reason and drops empty/undefined reasons', () => {
    expect(failed('load the record', new Error('row not found'))).toBe(
      "Couldn't load the record — row not found.",
    );
    expect(failed('load the record', new Error(''))).toBe("Couldn't load the record.");
    expect(failed('load the record', '   ')).toBe("Couldn't load the record.");
    expect(failed('load the record', { weird: true })).toBe("Couldn't load the record.");
    expect(failed('load the record', null)).not.toContain('undefined');
  });

  it('does not double the "Failed to"/"Couldn\'t" prefix when a caller passes legacy copy', () => {
    expect(failed('Failed to save note')).toBe("Couldn't save note.");
    expect(failed("Couldn't save note.")).toBe("Couldn't save note.");
  });

  it('strips a "Failed to" / "Couldn\'t" prefix from the reason', () => {
    expect(failed('save the note', 'Failed to validate: email is required')).toBe(
      "Couldn't save the note — validate: email is required.",
    );
    expect(failed('save the note', "Couldn't parse the date.")).toBe(
      "Couldn't save the note — parse the date.",
    );
    expect(failed('save the note', new Error('failed to parse the date'), 'Try again')).toBe(
      "Couldn't save the note — parse the date. Try again.",
    );
  });

  it('reads "reach the server" as no connection instead of the old grammar slip', () => {
    // Was: "Couldn't save the note — reach the server." (FB-9 grammar case)
    expect(failed('save the note', 'Failed to reach the server')).toBe(
      "Couldn't save the note — no connection.",
    );
    expect(failed('save the note', "Couldn't reach the server.")).toBe(
      "Couldn't save the note — no connection.",
    );
    expect(failed('save the note', new Error('failed to reach the server'), 'Try again')).toBe(
      "Couldn't save the note — no connection. Try again.",
    );
  });

  it('drops the reason when it only repeats the action', () => {
    expect(failed('create the module', 'Failed to create module')).toBe("Couldn't create the module.");
    expect(failed('create the module', 'Failed to create module.', 'Try again')).toBe(
      "Couldn't create the module. Try again.",
    );
    expect(failed('create the module', "Couldn't create the module")).toBe("Couldn't create the module.");
    expect(failed('create the module', 'Create the module')).toBe("Couldn't create the module.");
    expect(failed('create the module', new Error('Failed to create module'))).toBe(
      "Couldn't create the module.",
    );
    // A reason that adds information is kept.
    expect(failed('create the module', 'Failed to create module: name already taken')).toBe(
      "Couldn't create the module — name already taken.",
    );
    expect(failed('save the note', 'Failed to save note - row not found')).toBe(
      "Couldn't save the note — row not found.",
    );
    expect(failed('save the note', 'HTTP 500: server error')).toBe(
      "Couldn't save the note — server error.",
    );
    expect(failed('create the module', 'name already taken')).toBe(
      "Couldn't create the module — name already taken.",
    );
  });
});

describe('failed() humanises reasons (FB-9)', () => {
  it('maps RLS / permission / 403 / 42501 to "you don\'t have access to this record"', () => {
    expect(
      failed(
        'save the note',
        new Error('new row violates row-level security policy for table "crm_notes"'),
      ),
    ).toBe("Couldn't save the note — you don't have access to this record.");
    expect(failed('save the note', 'permission denied for table crm_notes')).toBe(
      "Couldn't save the note — you don't have access to this record.",
    );
    expect(failed('update the record', 'HTTP 403: Forbidden')).toBe(
      "Couldn't update the record — you don't have access to this record.",
    );
    expect(failed('update the record', 'You are not allowed to edit this record')).toBe(
      "Couldn't update the record — you don't have access to this record.",
    );
    // Postgrest error object (not an Error instance): code alone is enough.
    expect(
      failed('update the record', { message: 'permission denied', code: '42501', details: null }),
    ).toBe("Couldn't update the record — you don't have access to this record.");
    expect(failed('update the record', { message: 'nope', status: 403 })).toBe(
      "Couldn't update the record — you don't have access to this record.",
    );
    // The family wording is exported so callers/tests share one string.
    expect(failed('save the note', 'row-level security')).toBe(
      `Couldn't save the note — ${FAILED_REASON.noAccess}.`,
    );
  });

  it('maps fetch/network failures to "no connection"', () => {
    expect(failed('load the record', new TypeError('Failed to fetch'))).toBe(
      "Couldn't load the record — no connection.",
    );
    expect(failed('load the record', 'NetworkError when attempting to fetch resource.')).toBe(
      "Couldn't load the record — no connection.",
    );
    expect(failed('load the record', new TypeError('Load failed'))).toBe(
      "Couldn't load the record — no connection.",
    );
    expect(failed('load the record', 'connect ECONNREFUSED 127.0.0.1:54321')).toBe(
      "Couldn't load the record — no connection.",
    );
    // "Upload failed" is not Safari's "Load failed".
    expect(failed('save the file', 'Upload failed: file too large')).toBe(
      "Couldn't save the file — Upload failed: file too large.",
    );
  });

  it('maps timeouts to "the request timed out"', () => {
    expect(failed('load the list', 'network timeout')).toBe(
      "Couldn't load the list — the request timed out.",
    );
    expect(failed('load the list', 'The request timed out after 30s')).toBe(
      "Couldn't load the list — the request timed out.",
    );
    expect(failed('load the list', { message: 'canceling statement due to statement timeout', code: '57014' })).toBe(
      "Couldn't load the list — the request timed out.",
    );
    expect(failed('load the list', 'HTTP 504: Gateway Timeout')).toBe(
      "Couldn't load the list — the request timed out.",
    );
    // Validation text that merely mentions the word survives.
    expect(failed('save the settings', 'Timeout must be between 1 and 60 minutes')).toBe(
      "Couldn't save the settings — Timeout must be between 1 and 60 minutes.",
    );
  });

  it('maps HTTP 5xx and HTML error pages to "server error"', () => {
    expect(failed('save the note', 'HTTP 500: server error')).toBe(
      "Couldn't save the note — server error.",
    );
    expect(failed('save the note', 'Request failed with status code 502')).toBe(
      "Couldn't save the note — server error.",
    );
    expect(failed('save the note', '503 Service Unavailable')).toBe(
      "Couldn't save the note — server error.",
    );
    expect(failed('save the note', { message: 'boom', status: 500 })).toBe(
      "Couldn't save the note — server error.",
    );
    expect(failed('save the note', '<!DOCTYPE html><html><head><title>502 Bad Gateway</title>')).toBe(
      "Couldn't save the note — server error.",
    );
    // A 4xx status with a useful body keeps the body.
    expect(failed('save the note', { message: 'Body must be under 10,000 characters', status: 400 })).toBe(
      "Couldn't save the note — Body must be under 10,000 characters.",
    );
  });

  it('reads an expired session, a .single() miss and a unique-constraint hit', () => {
    expect(failed('save the note', new Error('JWT expired'))).toBe(
      `Couldn't save the note — ${FAILED_REASON.sessionExpired}.`,
    );
    expect(failed('save the note', { message: 'x', status: 401 })).toBe(
      `Couldn't save the note — ${FAILED_REASON.sessionExpired}.`,
    );
    expect(
      failed('load the record', {
        message: 'JSON object requested, multiple (or no) rows returned',
        code: 'PGRST116',
      }),
    ).toBe(`Couldn't load the record — ${FAILED_REASON.notFound}.`);
    expect(
      failed('create the contact', {
        message: 'duplicate key value violates unique constraint "crm_records_email_key"',
        code: '23505',
      }),
    ).toBe(`Couldn't create the contact — ${FAILED_REASON.duplicate}.`);
  });

  it('drops PGRST / SQLSTATE / HTTP code noise and stack prefixes but keeps useful text', () => {
    expect(failed('save the note', 'PGRST204: Could not find the \'foo\' column of \'crm_notes\'')).toBe(
      "Couldn't save the note — Could not find the 'foo' column of 'crm_notes'.",
    );
    expect(failed('save the note', '[23502] null value in column "body" violates not-null constraint')).toBe(
      "Couldn't save the note — null value in column \"body\" violates not-null constraint.",
    );
    expect(failed('save the note', 'Error: Email is required')).toBe(
      "Couldn't save the note — Email is required.",
    );
    expect(failed('save the note', 'Email is required (code 22P02)')).toBe(
      "Couldn't save the note — Email is required.",
    );
    expect(failed('save the note', 'HTTP 400: Email is required')).toBe(
      "Couldn't save the note — Email is required.",
    );
    // A reason that is only a code says nothing.
    expect(failed('save the note', 'PGRST301')).toBe("Couldn't save the note.");
    expect(failed('save the note', { message: '', code: '22P02' })).toBe("Couldn't save the note.");
    // Multi-line messages keep the first line only.
    expect(failed('save the note', 'Email is required\n    at save (file.ts:1:1)')).toBe(
      "Couldn't save the note — Email is required.",
    );
    // Plain text survives untouched.
    expect(failed('save the note', 'Email is required')).toBe(
      "Couldn't save the note — Email is required.",
    );
    // "100 records…" is not an HTTP code prefix.
    expect(failed('import the file', '100 rows skipped: missing phone')).toBe(
      "Couldn't import the file — 100 rows skipped: missing phone.",
    );
  });

  it('unwraps JSON error bodies and Postgrest-style objects', () => {
    expect(failed('save the note', '{"error":"Body is required"}')).toBe(
      "Couldn't save the note — Body is required.",
    );
    expect(failed('save the note', new Error('{"message":"Body is required","code":"P0001"}'))).toBe(
      "Couldn't save the note — Body is required.",
    );
    expect(failed('save the note', { error: 'Body is required' })).toBe(
      "Couldn't save the note — Body is required.",
    );
    expect(failed('save the note', { message: 'Body is required', code: 'P0001', details: null, hint: null })).toBe(
      "Couldn't save the note — Body is required.",
    );
    expect(failed('save the note', { weird: true })).toBe("Couldn't save the note.");
    expect(failed('save the note', 42)).toBe("Couldn't save the note.");
  });

  it('caps a long reason at about 80 characters on a word boundary with an ellipsis glyph', () => {
    const long =
      'The value you entered for the secondary emergency contact phone number field does not match the expected format for this region and cannot be stored';
    const out = failed('save the record', long);
    const reason = out.slice("Couldn't save the record — ".length, -1);
    expect(reason.endsWith('…')).toBe(true);
    expect(reason).not.toContain('...');
    expect(reason.length).toBeLessThanOrEqual(FAILED_REASON_MAX_CHARS + 1);
    expect(reason.length).toBeGreaterThan(FAILED_REASON_MAX_CHARS / 2);
    // Cut on a word boundary, not mid-word.
    expect(long.startsWith(reason.slice(0, -1))).toBe(true);
    expect(long[reason.length - 1]).toBe(' ');
    // Short reasons are never touched.
    expect(failed('save the record', 'Email is required')).toBe(
      "Couldn't save the record — Email is required.",
    );
  });
});

describe('sessionExpired()', () => {
  it('returns to the current /crm path via the redirect param the login page reads', () => {
    const s = sessionExpired('/crm/organizer');
    expect(s.title).toBe('Your session expired — sign in again');
    expect(s.href).toBe('/crm-login?redirect=%2Fcrm%2Forganizer');
    expect(s.actionLabel).toBe('Sign in');
    expect(s.description.length).toBeGreaterThan(0);
  });

  it('falls back to /crm for missing or unsafe paths (mirrors safeCrmRedirect)', () => {
    expect(sessionExpired(null).href).toBe('/crm-login?redirect=%2Fcrm');
    expect(sessionExpired(undefined).href).toBe('/crm-login?redirect=%2Fcrm');
    expect(sessionExpired('//evil.example.com').href).toBe('/crm-login?redirect=%2Fcrm');
    expect(sessionExpired('/portal/x').href).toBe('/crm-login?redirect=%2Fcrm');
  });
});

describe('counted templates', () => {
  it('pluralize handles regular, sibilant, -y and explicit nouns', () => {
    expect(toastCopy.pluralize('record', 1)).toBe('record');
    expect(toastCopy.pluralize('record', 2)).toBe('records');
    expect(toastCopy.pluralize('record', 0)).toBe('records');
    expect(toastCopy.pluralize('match', 3)).toBe('matches');
    expect(toastCopy.pluralize('entry', 3)).toBe('entries');
    expect(toastCopy.pluralize('day', 3)).toBe('days');
    expect(toastCopy.pluralize({ one: 'person', other: 'people' }, 1)).toBe('person');
    expect(toastCopy.pluralize({ one: 'person', other: 'people' }, 2)).toBe('people');
  });

  it('counted() reads "Verb N nouns" with thousands grouping', () => {
    expect(toastCopy.counted('record', 1200, 'Selected')).toBe('Selected 1,200 records');
    expect(toastCopy.counted('record', 1, 'Restored')).toBe('Restored 1 record');
    expect(toastCopy.counted({ one: 'member', other: 'members' }, 1, 'exported')).toBe(
      'Exported 1 member',
    );
    expect(toastCopy.counted({ one: 'member', other: 'members' }, 3, 'Exported')).toBe(
      'Exported 3 members',
    );
  });

  it('bulkTitle() follows D9: "Status updated · 12 records"', () => {
    expect(toastCopy.bulkTitle('Status updated', 12)).toBe('Status updated · 12 records');
    expect(toastCopy.bulkTitle('Owner cleared', 1)).toBe('Owner cleared · 1 record');
    expect(toastCopy.bulkTitle('Stage updated', 2, 'deal')).toBe('Stage updated · 2 deals');
    expect(toastCopy.bulkTitle('Tags added.', 2500)).toBe('Tags added · 2,500 records');
  });

  it('movedToTrash() / restored() share the counted wording', () => {
    expect(toastCopy.movedToTrash()).toBe('Moved to Trash');
    expect(toastCopy.movedToTrash(1)).toBe('Moved to Trash');
    expect(toastCopy.movedToTrash(12)).toBe('Moved to Trash · 12 records');
    expect(toastCopy.restored('Record')).toBe('Record restored');
    expect(toastCopy.restored('task.')).toBe('Task restored');
  });

  it('cappedSelection() / exportedAll() / chooseFirst() are stable', () => {
    const capped = toastCopy.cappedSelection(5000, 12340);
    expect(capped.title).toBe('Selected first 5,000 of 12,340 matches');
    expect(capped.description).toBe('Narrow your filters to act on all rows.');
    expect(toastCopy.exportedAll('record').title).toBe('Exported all matching records');
    expect(toastCopy.exportedAll({ one: 'member', other: 'members' }).title).toBe(
      'Exported all matching members',
    );
    expect(toastCopy.exportedAll('record').description).toContain('Same filters and sort');
    expect(toastCopy.chooseFirst('an owner')).toBe('Choose an owner first');
    expect(toastCopy.chooseFirst('at least one tag.')).toBe('Choose at least one tag first');
  });
});

describe('partial()', () => {
  it('is a plain success when every row changed', () => {
    expect(toastCopy.partial('Status updated', { changed: 12 })).toEqual({
      title: 'Status updated · 12 records',
      tone: 'success',
    });
    expect(toastCopy.partial('Status updated', { changed: 12, skipped: 0, failed: 0 })).toEqual({
      title: 'Status updated · 12 records',
      tone: 'success',
    });
  });

  it('shows the detail as the description on a clean success only', () => {
    expect(
      toastCopy.partial('Status updated', { changed: 3 }, { detail: 'Now "Active"' }),
    ).toEqual({ title: 'Status updated · 3 records', description: 'Now "Active".', tone: 'success' });
    const warn = toastCopy.partial('Status updated', { changed: 3, skipped: 1 }, { detail: 'Now "Active"' });
    expect(warn.description).not.toContain('Active');
  });

  it('escalates to warning when rows were skipped', () => {
    expect(toastCopy.partial('Status updated', { changed: 10, skipped: 2 })).toEqual({
      title: 'Status updated · 10 records',
      description: '2 skipped — skipped rows may be in another org or deleted.',
      tone: 'warning',
    });
  });

  it('escalates to error when any row failed, listing skipped and failed counts', () => {
    expect(toastCopy.partial('Status updated', { changed: 9, skipped: 2, failed: 1 })).toEqual({
      title: 'Status updated · 9 records',
      description: '2 skipped · 1 failed — failed rows were not changed. Try again.',
      tone: 'error',
    });
    expect(toastCopy.partial('Moved to Trash', { changed: 0, failed: 3 })).toEqual({
      title: 'Moved to Trash · 0 records',
      description: '3 failed — failed rows were not changed. Try again.',
      tone: 'error',
    });
  });

  it('respects the unit noun and never goes negative', () => {
    expect(toastCopy.partial('Stage updated', { changed: 1, skipped: 1 }, { unit: 'deal' }).title).toBe(
      'Stage updated · 1 deal',
    );
    expect(toastCopy.partial('Stage updated', { changed: -4 }).title).toBe('Stage updated · 0 records');
  });
});

describe('queued()', () => {
  it('uses the one offline title for every shape', () => {
    const title = 'Queued — will sync when reconnected';
    expect(toastCopy.queued().title).toBe(title);
    expect(toastCopy.queued('task').title).toBe(title);
    expect(toastCopy.queued('record', 12).title).toBe(title);
  });

  it('varies only the description', () => {
    expect(toastCopy.queued().description).toBe(
      "Saved on this device — it will sync when you're back online.",
    );
    expect(toastCopy.queued('task').description).toBe(
      "Task saved on this device — it will sync when you're back online.",
    );
    expect(toastCopy.queued('record', 1).description).toBe("1 record will update when you're back online.");
    expect(toastCopy.queued('deal', 3).description).toBe("3 deals will update when you're back online.");
    expect(toastCopy.queued({ one: 'note', other: 'notes' }).description).toBe(
      "Note saved on this device — it will sync when you're back online.",
    );
  });
});

describe('loadingCopy()', () => {
  it('ends in the single ellipsis glyph exactly once', () => {
    expect(toastCopy.loadingCopy('Building CSV')).toBe('Building CSV…');
    expect(toastCopy.loadingCopy('Building CSV…')).toBe('Building CSV…');
    expect(toastCopy.loadingCopy('Building CSV...')).toBe('Building CSV…');
    expect(toastCopy.loadingCopy('saving')).toBe('Saving…');
  });
});

describe('viewSaved()', () => {
  it('names the view and counts filters', () => {
    expect(toastCopy.viewSaved('My leads', 2)).toEqual({
      title: 'View "My leads" saved',
      description: '2 filters applied',
    });
    expect(toastCopy.viewSaved('  Hot  ', 1)).toEqual({
      title: 'View "Hot" saved',
      description: '1 filter applied',
    });
  });

  it('says so when the view has no filters, and tolerates an empty name', () => {
    expect(toastCopy.viewSaved('All', 0).description).toBe('No filters — shows every record');
    expect(toastCopy.viewSaved('', 0).title).toBe('View saved');
  });
});

describe('addedWithAction() — D1 "Member added · View in list"', () => {
  it('keeps the title identical to added(noun) and offers "View in list"', () => {
    const c = toastCopy.addedWithAction('Member');
    expect(c.title).toBe(toastCopy.added('Member'));
    expect(c.title).toBe('Member added');
    expect(c.actionLabel).toBe('View in list');
    expect(c.description).toBeUndefined();
  });

  it('carries the honest Members note as the description when asked', () => {
    const c = toastCopy.addedWithAction('Member', { note: MEMBERS_FILLS_FROM_ENROLLMENT });
    expect(c.description).toBe(MEMBERS_FILLS_FROM_ENROLLMENT);
    expect(c.description).toMatch(/Members fills from enrollment/);
    expect(c.description).not.toContain('...');
  });

  it('accepts a custom action label and drops an empty note', () => {
    expect(toastCopy.addedWithAction('Lead', { actionLabel: 'open list.' }).actionLabel).toBe('Open list');
    expect(toastCopy.addedWithAction('Lead', { note: '   ' }).description).toBeUndefined();
  });
});

describe('mergedInto() — CLOSE-1: one voice for a merged-away record URL', () => {
  it('quotes the keeper when known and says the URL is about to change', () => {
    const c = toastCopy.mergedInto('Jane Doe', { navigating: true });
    expect(c.title).toBe('That record was merged into "Jane Doe"');
    expect(c.description).toBe('Opening the current version…');
  });

  it('already landed on the keeper: present tense, no navigation promise', () => {
    const c = toastCopy.mergedInto('Jane Doe');
    expect(c.title).toBe('That record was merged into "Jane Doe"');
    expect(c.description).toBe("You're viewing the current version.");
  });

  it('never prints an empty or undefined keeper name', () => {
    for (const missing of [undefined, null, '', '   ']) {
      expect(toastCopy.mergedInto(missing).title).toBe('That record was merged');
    }
  });

  it('uses the ellipsis glyph, never three dots', () => {
    expect(toastCopy.mergedInto('X', { navigating: true }).description).not.toContain('...');
    expect(toastCopy.mergedInto('X', { navigating: true }).description).toContain('…');
  });

  it('names the Contact when an imported Member twin is opened', () => {
    expect(toastCopy.openedContactTwin('John Raker')).toEqual({
      title: 'Opened the Contact record for John Raker',
      description: 'Notes and history live here, not on the imported Member copy.',
    });
    expect(toastCopy.openedContactTwin(null).title).toBe('Opened the Contact record');
  });

  it('both callers share one title — only the follow-up sentence differs', () => {
    expect(toastCopy.mergedInto('Jane Doe', { navigating: true }).title).toBe(
      toastCopy.mergedInto('Jane Doe').title,
    );
  });
});

describe('bulk-update page copy (CLOSE-1) — partial() over the /records/bulk shape', () => {
  const unit = { one: 'contact', other: 'contacts' };

  it('clean run: one success toast, module noun, D9 middle dot', () => {
    const c = toastCopy.partial('Status updated', { changed: 12, skipped: 0, failed: 0 }, { unit });
    expect(c.title).toBe('Status updated · 12 contacts');
    expect(c.description).toBeUndefined();
    expect(c.tone).toBe('success');
  });

  it('rows the server refused escalate to warning, not a second toast', () => {
    const c = toastCopy.partial('Owner updated', { changed: 10, skipped: 2, failed: 0 }, { unit });
    expect(c.title).toBe('Owner updated · 10 contacts');
    expect(c.description).toContain('2 skipped');
    expect(c.tone).toBe('warning');
  });

  it('failures escalate to error and say the rows were not changed', () => {
    const c = toastCopy.partial('Field updated', { changed: 9, skipped: 2, failed: 1 }, { unit });
    expect(c.title).toBe('Field updated · 9 contacts');
    expect(c.description).toBe('2 skipped · 1 failed — failed rows were not changed. Try again.');
    expect(c.tone).toBe('error');
  });

  it('the success banner reads with the same noun as the toast', () => {
    expect(toastCopy.counted(unit, 1, 'Updated')).toBe('Updated 1 contact');
    expect(toastCopy.counted(unit, 1200, 'Updated')).toBe('Updated 1,200 contacts');
  });

  it('a failed request names the action and humanises the status, not "Failed to …"', () => {
    const forbidden = Object.assign(new Error('HTTP 403'), { status: 403 });
    expect(toastCopy.failed('update the contacts', forbidden, 'Try again')).toBe(
      "Couldn't update the contacts — you don't have access to this record. Try again.",
    );
    const serverDown = Object.assign(new Error('HTTP 500'), { status: 500 });
    expect(toastCopy.failed('update the contacts', serverDown, 'Try again')).toBe(
      "Couldn't update the contacts — server error. Try again.",
    );
  });
});
