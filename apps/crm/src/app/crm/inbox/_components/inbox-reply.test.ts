import { describe, expect, it } from 'vitest';
import type { InboxMessage } from '@/lib/inbox/types';
import {
  appendSignatureHtml,
  buildReplyQuotedHtml,
  pickSignatureForCompose,
  replyHasUserContent,
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

  it('returns empty when there is no inbound letter', () => {
    expect(buildReplyQuotedHtml(null)).toBe('');
  });
});
