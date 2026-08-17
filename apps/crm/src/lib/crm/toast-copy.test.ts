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
