import { describe, expect, it } from 'vitest';
import {
  buildNewMailToast,
  decideNotify,
  MAX_SNIPPET_LENGTH,
  previewSnippet,
  type IncomingMessage,
} from './new-mail-notification';

function message(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    direction: 'inbound',
    from_address: 'member@proton.me',
    from_name: 'Jane Pietruszka',
    subject: 'Question about my plan',
    body_text: 'Can you confirm my September coverage?',
    to_address: 'enrollment@payitforwardhealth.com',
    ...overrides,
  };
}

const noneSeen: ReadonlySet<string> = new Set();

describe('decideNotify', () => {
  it('announces genuinely new inbound mail', () => {
    expect(
      decideNotify({ message: message(), pathname: '/crm/dashboard', seenMessageIds: noneSeen }),
    ).toEqual({ notify: true });
  });

  it('never announces our own outbound reply', () => {
    expect(
      decideNotify({
        message: message({ direction: 'outbound' }),
        pathname: '/crm/dashboard',
        seenMessageIds: noneSeen,
      }),
    ).toEqual({ notify: false, reason: 'outbound' });
  });

  it('suppresses a redelivered message so reconnects do not double-toast', () => {
    expect(
      decideNotify({
        message: message(),
        pathname: '/crm/dashboard',
        seenMessageIds: new Set(['msg-1']),
      }),
    ).toEqual({ notify: false, reason: 'duplicate' });
  });

  it('stays quiet about the thread already on screen', () => {
    expect(
      decideNotify({
        message: message(),
        pathname: '/crm/inbox/conv-1',
        seenMessageIds: noneSeen,
      }),
    ).toEqual({ notify: false, reason: 'already-viewing' });
  });

  it('still announces that thread when the tab is in the background', () => {
    expect(
      decideNotify({
        message: message(),
        pathname: '/crm/inbox/conv-1',
        seenMessageIds: noneSeen,
        documentVisible: false,
      }),
    ).toEqual({ notify: true });
  });

  it('stays quiet about the thread selected via ?c=', () => {
    expect(
      decideNotify({
        message: message(),
        pathname: '/crm/inbox',
        search: 'c=conv-1',
        seenMessageIds: noneSeen,
      }),
    ).toEqual({ notify: false, reason: 'already-viewing' });
  });

  it('announces a different thread while one is open', () => {
    expect(
      decideNotify({
        message: message({ conversation_id: 'conv-2' }),
        pathname: '/crm/inbox/conv-1',
        seenMessageIds: noneSeen,
      }),
    ).toEqual({ notify: true });
  });

  it('refuses a message with no conversation to link to', () => {
    expect(
      decideNotify({
        message: message({ conversation_id: '' }),
        pathname: '/crm/dashboard',
        seenMessageIds: noneSeen,
      }),
    ).toEqual({ notify: false, reason: 'missing-conversation' });
  });
});

describe('previewSnippet', () => {
  it('is empty when the body never hydrated', () => {
    expect(previewSnippet(null)).toBe('');
    expect(previewSnippet('')).toBe('');
  });

  it('drops the quoted chain below a reply', () => {
    const body = ['tes reply', '', '> This is a test from the CRM.', '> second quoted line'].join('\n');
    expect(previewSnippet(body)).toBe('tes reply');
  });

  it('drops the "On ... wrote:" attribution line and everything after', () => {
    const body = [
      'Sounds good, thanks!',
      'On Thursday, July 30th, 2026 at 12:38 AM, Enrollment <e@x.com> wrote:',
      'original message',
    ].join('\n');
    expect(previewSnippet(body)).toBe('Sounds good, thanks!');
  });

  it('stops at a signature delimiter', () => {
    expect(previewSnippet(['Please advise.', '--', 'Jane, Sr. Advisor'].join('\n'))).toBe(
      'Please advise.',
    );
  });

  it('collapses whitespace into a single line', () => {
    expect(previewSnippet('line one\n\n   line two')).toBe('line one line two');
  });

  it('truncates long bodies with an ellipsis', () => {
    const snippet = previewSnippet('x'.repeat(400));
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(MAX_SNIPPET_LENGTH + 1);
  });
});

describe('buildNewMailToast', () => {
  it('leads with the sender name and links to the thread', () => {
    const toast = buildNewMailToast(message());
    expect(toast.title).toBe('New email from Jane Pietruszka');
    expect(toast.description).toBe('Question about my plan — Can you confirm my September coverage?');
    expect(toast.href).toBe('/crm/inbox?c=conv-1');
    expect(toast.mailbox).toBe('enrollment@payitforwardhealth.com');
  });

  it('falls back to the address when there is no display name', () => {
    expect(buildNewMailToast(message({ from_name: null })).title).toBe(
      'New email from member@proton.me',
    );
  });

  it('degrades to a known label when the sender is unusable', () => {
    expect(buildNewMailToast(message({ from_name: '', from_address: '' })).title).toBe(
      'New email from Unknown sender',
    );
  });

  it('remains useful when the body failed to hydrate', () => {
    const toast = buildNewMailToast(message({ body_text: null }));
    expect(toast.description).toBe('Question about my plan');
  });

  it('says so explicitly when there is no subject either', () => {
    expect(buildNewMailToast(message({ subject: null, body_text: null })).description).toBe(
      '(no subject)',
    );
  });
});
