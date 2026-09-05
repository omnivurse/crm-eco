import { describe, expect, it } from 'vitest';
import { buildPrintDocument, escapeHtml } from './inbox-print';

const passthrough = (html: string) => html;

describe('escapeHtml', () => {
  it('neutralises markup in attacker-controlled display text', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeHtml('Ben & "Jerry"')).toBe('Ben &amp; &quot;Jerry&quot;');
  });

  it('renders missing values as empty rather than "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('buildPrintDocument', () => {
  const conversation = { subject: 'Invoice 10428', contact_name: 'Frank', contact_email: 'frank@bank.example' };
  const messages = [
    {
      id: 'm1',
      direction: 'inbound',
      from_name: 'Frank',
      from_address: 'frank@bank.example',
      to_address: 'billing@payitforwardhealth.com',
      subject: 'Invoice 10428',
      body_html: '<p>First</p>',
      sent_at: '2026-09-01T12:00:00Z',
    },
    {
      id: 'm2',
      direction: 'outbound',
      from_name: null,
      from_address: null,
      body_text: 'line one\nline two',
      sent_at: '2026-09-02T12:00:00Z',
    },
  ];

  it('prints the messages in the order it was handed', () => {
    const doc = buildPrintDocument(conversation, messages, passthrough);
    expect(doc.indexOf('First')).toBeLessThan(doc.indexOf('line one'));
  });

  it('sends every HTML body through the caller-supplied sanitizer', () => {
    const seen: string[] = [];
    buildPrintDocument(conversation, messages, (html) => {
      seen.push(html);
      return 'CLEAN';
    });
    expect(seen).toEqual(['<p>First</p>']);
  });

  it('keeps line breaks on a plain-text message', () => {
    const doc = buildPrintDocument(conversation, messages, passthrough);
    expect(doc).toContain('<pre class="text">line one\nline two</pre>');
  });

  it('escapes a hostile display name instead of printing it as markup', () => {
    const doc = buildPrintDocument(
      { subject: '<img src=x onerror=alert(1)>' },
      [{ id: 'm', direction: 'inbound', from_name: '<b>Bad</b>', body_text: 'hi' }],
      passthrough,
    );
    expect(doc).not.toContain('<img src=x');
    expect(doc).not.toContain('<b>Bad</b>');
    expect(doc).toContain('&lt;b&gt;Bad&lt;/b&gt;');
  });

  it('names the outbound sender rather than leaving the line blank', () => {
    const doc = buildPrintDocument(conversation, messages, passthrough);
    expect(doc).toContain('You');
  });

  it('survives a thread with no subject and no messages', () => {
    const doc = buildPrintDocument({}, [], passthrough);
    expect(doc).toContain('(No subject)');
    expect(doc).toContain('0 messages');
  });

  it('counts one message without pluralising', () => {
    const doc = buildPrintDocument(conversation, [messages[0]], passthrough);
    expect(doc).toContain('1 message');
    expect(doc).not.toContain('1 messages');
  });
});
