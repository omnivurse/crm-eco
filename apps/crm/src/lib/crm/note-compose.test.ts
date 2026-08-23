import { describe, expect, it } from 'vitest';
import {
  isRecordNotePane,
  parseRecordComposeParams,
  recordNoteComposeHref,
  recordPaneHref,
} from './note-compose';

describe('isRecordNotePane', () => {
  it('accepts the V2 pane set', () => {
    expect(isRecordNotePane('notes')).toBe(true);
    expect(isRecordNotePane('timeline')).toBe(true);
    expect(isRecordNotePane('details')).toBe(false);
    expect(isRecordNotePane(null)).toBe(false);
  });
});

describe('parseRecordComposeParams', () => {
  it('opens the composer only for pane=notes&compose=1', () => {
    expect(parseRecordComposeParams(new URLSearchParams('pane=notes&compose=1'))).toEqual({
      pane: 'notes',
      compose: true,
    });
    expect(parseRecordComposeParams(new URLSearchParams('pane=notes&compose=true'))).toEqual({
      pane: 'notes',
      compose: true,
    });
  });

  it('does not compose on other panes or missing flag', () => {
    expect(parseRecordComposeParams(new URLSearchParams('pane=notes'))).toEqual({
      pane: 'notes',
      compose: false,
    });
    expect(parseRecordComposeParams(new URLSearchParams('pane=emails&compose=1'))).toEqual({
      pane: 'emails',
      compose: false,
    });
    expect(parseRecordComposeParams(new URLSearchParams('compose=1'))).toEqual({
      pane: null,
      compose: false,
    });
  });
});

describe('recordNoteComposeHref', () => {
  it('encodes the record id and compose query', () => {
    expect(recordNoteComposeHref('abc')).toBe('/crm/r/abc?pane=notes&compose=1');
    expect(recordNoteComposeHref('a/b')).toBe('/crm/r/a%2Fb?pane=notes&compose=1');
  });
});

describe('recordPaneHref (RP-7)', () => {
  const list = '/crm/modules/contacts?status=Pending&page=2';
  it('mirrors the pane and keeps returnTo so Back still restores the list', () => {
    const sp = new URLSearchParams({ returnTo: list });
    const href = recordPaneHref('/crm/r/abc', sp, 'notes');
    const url = new URL(href, 'http://x');
    expect(url.pathname).toBe('/crm/r/abc');
    expect(url.searchParams.get('pane')).toBe('notes');
    expect(url.searchParams.get('returnTo')).toBe(list);
  });

  it('strips compose so a reload does not re-open the composer', () => {
    const href = recordPaneHref('/crm/r/abc', new URLSearchParams('pane=notes&compose=1'), 'notes');
    expect(href).toBe('/crm/r/abc?pane=notes');
  });

  it('drops ?pane for the default Details pane and leaves no dangling "?"', () => {
    expect(recordPaneHref('/crm/r/abc', new URLSearchParams('pane=notes'), 'details')).toBe('/crm/r/abc');
    expect(recordPaneHref('/crm/r/abc', null, null)).toBe('/crm/r/abc');
    expect(recordPaneHref('/crm/r/abc', 'returnTo=%2Fcrm', 'details')).toBe('/crm/r/abc?returnTo=%2Fcrm');
  });

  it('replaces an existing pane and keeps unrelated params (ai, returnTo)', () => {
    const href = recordPaneHref('/crm/r/abc', 'pane=emails&returnTo=%2Fcrm&ai=email', 'timeline');
    const url = new URL(href, 'http://x');
    expect(url.searchParams.get('pane')).toBe('timeline');
    expect(url.searchParams.get('returnTo')).toBe('/crm');
    expect(url.searchParams.get('ai')).toBe('email');
  });

  it('round-trips through parseRecordComposeParams', () => {
    const href = recordPaneHref('/crm/r/abc', '', 'attachments');
    const parsed = parseRecordComposeParams(new URL(href, 'http://x').searchParams);
    expect(parsed).toEqual({ pane: 'attachments', compose: false });
  });
});
