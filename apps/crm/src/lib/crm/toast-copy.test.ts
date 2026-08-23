import { describe, it, expect } from 'vitest';
import { saved, added, updated, deleted, failed, sessionExpired, toastCopy } from './toast-copy';

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
    expect(failed('save the note', 'network timeout', 'Try again')).toBe(
      "Couldn't save the note — network timeout. Try again.",
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
    expect(failed('save the note', 'Failed to reach the server')).toBe(
      "Couldn't save the note — reach the server.",
    );
    expect(failed('save the note', "Couldn't reach the server.")).toBe(
      "Couldn't save the note — reach the server.",
    );
    expect(failed('save the note', new Error('failed to reach the server'), 'Try again')).toBe(
      "Couldn't save the note — reach the server. Try again.",
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
      "Couldn't save the note — HTTP 500: server error.",
    );
    expect(failed('create the module', 'name already taken')).toBe(
      "Couldn't create the module — name already taken.",
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
