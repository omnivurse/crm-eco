import { describe, expect, it } from 'vitest';
import type { InboxMessage } from '@/lib/inbox/types';
import {
  appendSignatureHtml,
  buildInboxReplyCompose,
  buildReplyQuotedHtml,
  pickSignatureForCompose,
  REPLY_COMPOSE_BLANK_LINES,
  replyComposePadHtml,
  replyHasUserContent,
  replySubject,
} from './inbox-reply';

const inbound = {
  id: 'm1',
  direction: 'inbound',
  from_name: 'Frank Burnham',
  from_address: 'frank.burnham@bankofcolorado.com',
  subject: 'RE: Account',
  body_text: 'Good morning, Wendy,\n\nPlease find the account details attached.',
  body_html: `<html xmlns:v="urn:schemas-microsoft-com:vml">${'x'.repeat(50_000)}</html>`,
  sent_at: '2026-09-03T15:49:59.000Z',
} as InboxMessage;

describe('pickSignatureForCompose', () => {
  const sigs = [
    { id: 'a', name: 'New only', content_html: '<p>A</p>', is_default: true, include_in_new: true, include_in_replies: false },
    { id: 'b', name: 'Replies', content_html: '<p>B</p>', is_default: false, include_in_new: false, include_in_replies: true },
  ];

  it('uses include_in_replies for reply and include_in_new for compose', () => {
    expect(pickSignatureForCompose(sigs, 'reply')?.id).toBe('b');
    expect(pickSignatureForCompose(sigs, 'new')?.id).toBe('a');
  });
});

describe('appendSignatureHtml', () => {
  it('appends the stored signature on send', () => {
    expect(appendSignatureHtml('<p>Thanks</p>', '<p>Wendy</p>')).toContain('--');
    expect(appendSignatureHtml('<p>Thanks</p>', '<p>Wendy</p>')).toContain('Wendy');
    expect(appendSignatureHtml('<p>Thanks</p>', '')).toBe('<p>Thanks</p>');
  });
});

describe('replyHasUserContent', () => {
  it('treats a quote-only dock as empty', () => {
    expect(replyHasUserContent(buildReplyQuotedHtml(inbound))).toBe(false);
    expect(replyHasUserContent(`<p>Got it</p>${buildReplyQuotedHtml(inbound)}`)).toBe(true);
    expect(replyHasUserContent('<p></p>')).toBe(false);
  });
});

describe('buildReplyQuotedHtml', () => {
  it('quotes stored text for heavy Outlook HTML', () => {
    const html = buildReplyQuotedHtml(inbound);
    expect(html).toContain('data-crm-quote="1"');
    expect(html).toContain('frank.burnham@bankofcolorado.com');
    expect(html).toContain('Please find the account details attached.');
    expect(html).not.toContain('xmlns:v=');
  });

  it('opens with blank lines above the quote so the reply has room to type', () => {
    const html = buildReplyQuotedHtml(inbound);
    const pad = html.slice(0, html.indexOf('data-crm-quote'));
    expect(pad.match(/<br>/g)?.length).toBe(REPLY_COMPOSE_BLANK_LINES);
    expect(replyHasUserContent(html)).toBe(false);
  });

  it('returns empty when there is no inbound letter', () => {
    expect(buildReplyQuotedHtml(null)).toBe('');
  });
});

describe('replyComposePadHtml', () => {
  it('emits one paragraph of hard breaks', () => {
    expect(replyComposePadHtml(10)).toBe(`<p>${'<br>'.repeat(10)}</p>`);
    expect(replyComposePadHtml(0)).toBe('<p><br></p>');
  });
});

describe('replySubject', () => {
  it('adds Re: once and leaves an existing prefix alone', () => {
    expect(replySubject('Account')).toBe('Re: Account');
    expect(replySubject('Re: Account')).toBe('Re: Account');
    expect(replySubject('RE: Account')).toBe('RE: Account');
    expect(replySubject(null)).toBe('Re:');
  });
});

describe('buildInboxReplyCompose', () => {
  const conversation = {
    id: 'conv-1',
    subject: 'Account',
    contact_email: 'frank.burnham@bankofcolorado.com',
    contact_name: 'Frank Burnham',
    contact_phone: null,
    mailbox_address: 'wendy@payitforwardhealth.com',
  };

  const mailboxes = [
    { email: 'wendy@payitforwardhealth.com', name: 'Wendy Scipione', isDefault: true },
  ];

  const inbound = {
    ...{
      id: 'm1',
      direction: 'inbound' as const,
      from_name: 'Frank Burnham',
      from_address: 'frank.burnham@bankofcolorado.com',
      to_address: 'wendy@payitforwardhealth.com',
      reply_to_address: null,
      cc_addresses: [
        { email: 'ops@bankofcolorado.com', name: 'Ops' },
        { email: 'wendy@payitforwardhealth.com' },
      ],
      subject: 'Account',
      body_text: 'Hello, Wendy,',
      body_html: '<p>Hello, Wendy,</p>',
      sent_at: '2026-09-03T20:45:13.000Z',
      message_id: '<frank-1@bankofcolorado.com>',
    },
  } as InboxMessage;

  it('opens a reply with To, Re: subject, quote, and thread headers', () => {
    const draft = buildInboxReplyCompose({
      mode: 'reply',
      conversation,
      messages: [inbound],
      authUserEmail: 'omnivurse@gmail.com',
      mailboxes,
      verifiedDomains: ['payitforwardhealth.com'],
    });

    expect(draft).not.toBeNull();
    expect(draft?.to).toEqual([
      { email: 'frank.burnham@bankofcolorado.com', name: 'Frank Burnham' },
    ]);
    expect(draft?.cc).toEqual([]);
    expect(draft?.subject).toBe('Re: Account');
    expect(draft?.body).toContain('data-crm-quote="1"');
    expect(draft?.body).toContain('Hello, Wendy,');
    expect(draft?.conversationId).toBe('conv-1');
    expect(draft?.inReplyTo).toBe('<frank-1@bankofcolorado.com>');
    expect(draft?.references).toContain('<frank-1@bankofcolorado.com>');
    expect(draft?.fromEmail).toBe('wendy@payitforwardhealth.com');
    expect(draft?.fromName).toBe('Wendy Scipione');
  });

  it('puts colleagues on CC for reply-all and drops our mailbox', () => {
    const draft = buildInboxReplyCompose({
      mode: 'reply_all',
      conversation,
      messages: [inbound],
      authUserEmail: 'omnivurse@gmail.com',
      mailboxes,
      verifiedDomains: ['payitforwardhealth.com'],
    });

    expect(draft?.cc).toEqual([{ email: 'ops@bankofcolorado.com', name: 'Ops' }]);
  });

  it('honours Reply-To when From is a no-reply gateway', () => {
    const draft = buildInboxReplyCompose({
      mode: 'reply',
      conversation,
      messages: [
        {
          ...inbound,
          from_address: 'noreply@hr-platform.example',
          reply_to_address: 'frank.burnham@bankofcolorado.com',
        },
      ],
      authUserEmail: 'omnivurse@gmail.com',
      mailboxes,
      verifiedDomains: ['payitforwardhealth.com'],
    });

    expect(draft?.to[0].email).toBe('frank.burnham@bankofcolorado.com');
  });

  it('returns null when there is no recipient at all', () => {
    expect(
      buildInboxReplyCompose({
        mode: 'reply',
        conversation: {
          ...conversation,
          contact_email: null,
          contact_phone: null,
        },
        messages: [],
        authUserEmail: 'omnivurse@gmail.com',
        mailboxes,
        verifiedDomains: ['payitforwardhealth.com'],
      }),
    ).toBeNull();
  });
});
