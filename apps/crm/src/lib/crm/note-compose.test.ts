import { describe, expect, it } from 'vitest';
import {
  isRecordNotePane,
  parseRecordComposeParams,
  recordNoteComposeHref,
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
