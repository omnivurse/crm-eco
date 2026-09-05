import { describe, expect, it } from 'vitest';
import {
  composeDockClass,
  composeDockTitle,
  composeHeaderTitle,
  composeIsDirty,
  htmlHasContent,
  parseComposeDockSize,
  persistableComposeDockSize,
  shouldDeleteDraftAfterSend,
} from './compose-dock';

describe('parseComposeDockSize', () => {
  it('accepts the three real sizes and rejects anything else', () => {
    expect(parseComposeDockSize('docked')).toBe('docked');
    expect(parseComposeDockSize('maximized')).toBe('maximized');
    expect(parseComposeDockSize('minimized')).toBe('minimized');
    expect(parseComposeDockSize('fullscreen')).toBeNull();
    expect(parseComposeDockSize('')).toBeNull();
    expect(parseComposeDockSize(null)).toBeNull();
    expect(parseComposeDockSize(undefined)).toBeNull();
  });
});

describe('persistableComposeDockSize', () => {
  it('never remembers minimized, so the next compose opens visible', () => {
    expect(persistableComposeDockSize('minimized')).toBeNull();
  });

  it('remembers the sizes the user chose on purpose', () => {
    expect(persistableComposeDockSize('docked')).toBe('docked');
    expect(persistableComposeDockSize('maximized')).toBe('maximized');
  });
});

describe('composeDockClass', () => {
  it('docks to the right edge on desktop and fills the screen below lg', () => {
    const cls = composeDockClass('docked');
    expect(cls).toContain('inset-0');
    expect(cls).toContain('lg:right-0');
    expect(cls).toContain('lg:w-[min(720px,55vw)]');
  });

  it('spans the workspace when maximized instead of covering the shell chrome', () => {
    const cls = composeDockClass('maximized');
    expect(cls).toContain('lg:inset-x-0');
    expect(cls).toContain('lg:top-[var(--crm-chrome-h)]');
    expect(cls).not.toContain('lg:w-[min(720px,55vw)]');
  });

  it('collapses to a corner bar when minimized', () => {
    const cls = composeDockClass('minimized');
    expect(cls).toContain('bottom-0');
    expect(cls).toContain('sm:w-80');
    expect(cls).toContain('h-auto');
    expect(cls).not.toContain('inset-0');
  });

  it('keeps the safe-area inset in every size so Send clears the iOS toolbar', () => {
    for (const size of ['docked', 'maximized', 'minimized'] as const) {
      expect(composeDockClass(size)).toContain('pb-[env(safe-area-inset-bottom)]');
    }
  });
});

describe('composeDockTitle', () => {
  it('falls back to a handle when the message has no subject yet', () => {
    expect(composeDockTitle(null)).toBe('New message');
    expect(composeDockTitle('   ')).toBe('New message');
    expect(composeDockTitle('Invoice 10428')).toBe('Invoice 10428');
  });
});

describe('composeHeaderTitle', () => {
  it('names a forward as a forward', () => {
    expect(composeHeaderTitle('Fwd: Roster')).toBe('Forward Email');
    expect(composeHeaderTitle('Re: Roster')).toBe('New Email');
    expect(composeHeaderTitle(undefined)).toBe('New Email');
  });
});

describe('htmlHasContent', () => {
  it("treats TipTap's empty documents as empty", () => {
    expect(htmlHasContent('')).toBe(false);
    expect(htmlHasContent(null)).toBe(false);
    expect(htmlHasContent('<p></p>')).toBe(false);
    expect(htmlHasContent('<p><br class="ProseMirror-trailingBreak"></p>')).toBe(false);
    expect(htmlHasContent('<p>&nbsp;</p>')).toBe(false);
  });

  it('counts real text and embedded media as content', () => {
    expect(htmlHasContent('<p>Hi</p>')).toBe(true);
    expect(htmlHasContent('<p><img src="cid:logo"></p>')).toBe(true);
    expect(htmlHasContent('<table><tr><td></td></tr></table>')).toBe(true);
  });
});

describe('composeIsDirty', () => {
  it('is clean for an untouched compose', () => {
    expect(composeIsDirty({})).toBe(false);
    expect(composeIsDirty({ to: [], subject: '  ', bodyHtml: '<p></p>', attachments: [] })).toBe(
      false,
    );
  });

  it('is dirty as soon as anything the user typed would be lost', () => {
    expect(composeIsDirty({ to: [{ email: 'a@b.test' }] })).toBe(true);
    expect(composeIsDirty({ cc: [{ email: 'a@b.test' }] })).toBe(true);
    expect(composeIsDirty({ bcc: [{ email: 'a@b.test' }] })).toBe(true);
    expect(composeIsDirty({ subject: 'Roster' })).toBe(true);
    expect(composeIsDirty({ bodyHtml: '<p>Hi</p>' })).toBe(true);
    expect(composeIsDirty({ attachments: [{}] })).toBe(true);
  });
});

describe('shouldDeleteDraftAfterSend', () => {
  it('keeps the draft when the inbox copy was not created', () => {
    expect(shouldDeleteDraftAfterSend({ ok: true })).toBe(false);
    expect(shouldDeleteDraftAfterSend({ ok: true, inbox_conversation_id: null })).toBe(false);
    expect(shouldDeleteDraftAfterSend({ ok: true, inbox_conversation_id: '   ' })).toBe(false);
  });

  it('keeps the draft when the send itself failed', () => {
    expect(shouldDeleteDraftAfterSend({ ok: false, inbox_conversation_id: 'c1' })).toBe(false);
  });

  it('deletes the draft only once the email exists in a thread', () => {
    expect(shouldDeleteDraftAfterSend({ ok: true, inbox_conversation_id: 'c1' })).toBe(true);
  });
});
