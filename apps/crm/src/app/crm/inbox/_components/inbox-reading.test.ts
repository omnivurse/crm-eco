import { describe, expect, it } from 'vitest';
import {
  EMAIL_IFRAME_SANDBOX,
  attachmentByteSize,
  defaultMessageExpanded,
  displaySenderName,
  emailIframeHeight,
  extractEmailBodyFragment,
  formatInboxFileSize,
  isHeavyEmailHtml,
  isLatestInbound,
  measureEmailDocument,
  shouldFollowNewMessages,
  shouldReadAsPlainText,
  stripExecutableMarkup,
  threadFaceFromMessages,
  unconstrainedIframeMeasureHeight,
} from './inbox-reading';

describe('formatInboxFileSize', () => {
  it('never prints NaN for missing or invalid inbound sizes', () => {
    expect(formatInboxFileSize(undefined)).toBeNull();
    expect(formatInboxFileSize(null)).toBeNull();
    expect(formatInboxFileSize(Number.NaN)).toBeNull();
    expect(formatInboxFileSize('')).toBeNull();
    expect(formatInboxFileSize(-4)).toBeNull();
  });

  it('formats finite sizes', () => {
    expect(formatInboxFileSize(0)).toBe('0 B');
    expect(formatInboxFileSize(512)).toBe('512 B');
    expect(formatInboxFileSize(2048)).toBe('2.0 KB');
    expect(formatInboxFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('attachmentByteSize', () => {
  it('prefers size, then file_size', () => {
    expect(attachmentByteSize({ size: 10, file_size: 99 })).toBe(10);
    expect(attachmentByteSize({ file_size: 99 })).toBe(99);
    expect(attachmentByteSize({})).toBeUndefined();
  });
});

describe('measureEmailDocument', () => {
  it('uses the tallest of body and html, with a readable floor', () => {
    expect(measureEmailDocument({})).toBe(80);
    expect(
      measureEmailDocument({
        body: { scrollHeight: 40, offsetHeight: 40 },
        documentElement: { scrollHeight: 40, offsetHeight: 40 },
      }),
    ).toBe(80);
    expect(
      measureEmailDocument({
        body: { scrollHeight: 640, offsetHeight: 400 },
        documentElement: { scrollHeight: 620, offsetHeight: 400 },
      }),
    ).toBe(656);
  });
});

describe('EMAIL_IFRAME_SANDBOX', () => {
  it('allows same-origin measure and never allows scripts', () => {
    expect(EMAIL_IFRAME_SANDBOX).toContain('allow-same-origin');
    expect(EMAIL_IFRAME_SANDBOX).not.toContain('allow-scripts');
  });
});

describe('extractEmailBodyFragment', () => {
  it('unwraps a full HTML document so srcDoc is not nested', () => {
    const doc = `<!DOCTYPE html><html><head><script>alert(1)</script></head><body><p>Line one</p><p>Line two</p></body></html>`;
    expect(extractEmailBodyFragment(doc)).toBe('<p>Line one</p><p>Line two</p>');
  });

  it('leaves a fragment unchanged', () => {
    expect(extractEmailBodyFragment('<p>Thanks</p>')).toBe('<p>Thanks</p>');
  });
});

describe('stripExecutableMarkup', () => {
  it('removes script tags so Chrome has nothing to execute in srcDoc', () => {
    expect(stripExecutableMarkup('<p>Hi</p><script>alert(1)</script>')).toBe('<p>Hi</p>');
  });
});

describe('unconstrainedIframeMeasureHeight', () => {
  it('shrinks the frame before measuring so an 80px viewport is not the result', () => {
    const iframe = {
      style: { height: '80px' },
      contentDocument: {
        body: { scrollHeight: 640, offsetHeight: 80 },
        documentElement: { scrollHeight: 640, offsetHeight: 80 },
      },
    };
    expect(unconstrainedIframeMeasureHeight(iframe)).toBe(656);
    expect(iframe.style.height).toBe('1px');
  });
});

describe('emailIframeHeight', () => {
  it('sizes to content — a short reply must NOT balloon into a screen-tall card', () => {
    expect(emailIframeHeight(96)).toBe(96);
    expect(emailIframeHeight(1200)).toBe(1200);
  });

  it('keeps a small readable floor when the measure fails', () => {
    expect(emailIframeHeight(0)).toBe(80);
    expect(emailIframeHeight(Number.NaN)).toBe(80);
  });
});

describe('shouldFollowNewMessages', () => {
  it('follows when the reader is at or near the bottom', () => {
    expect(
      shouldFollowNewMessages({ scrollTop: 1000, scrollHeight: 1600, clientHeight: 600 }),
    ).toBe(true);
    expect(
      shouldFollowNewMessages({ scrollTop: 900, scrollHeight: 1600, clientHeight: 600 }),
    ).toBe(true);
    // Pane that doesn't scroll at all.
    expect(
      shouldFollowNewMessages({ scrollTop: 0, scrollHeight: 400, clientHeight: 600 }),
    ).toBe(true);
  });

  it('never yanks a reader out of thread history', () => {
    expect(
      shouldFollowNewMessages({ scrollTop: 0, scrollHeight: 1600, clientHeight: 600 }),
    ).toBe(false);
  });
});

describe('displaySenderName', () => {
  it('uses the stored name when intake actually has one', () => {
    expect(displaySenderName('Dawn Marsh', 'dawn.marsh@bankofcolorado.com')).toBe('Dawn Marsh');
  });

  it('title-cases the local part when from_name is empty', () => {
    expect(displaySenderName('', 'frank.burnham@bankofcolorado.com')).toBe('Frank Burnham');
    expect(displaySenderName(null, 'dawn.marsh@bankofcolorado.com')).toBe('Dawn Marsh');
  });
});

describe('shouldReadAsPlainText', () => {
  it('switches Outlook Word HTML to the stored text body', () => {
    const html = `<html xmlns:v="urn:schemas-microsoft-com:vml">${'x'.repeat(50_000)}</html>`;
    expect(isHeavyEmailHtml(html)).toBe(true);
    expect(shouldReadAsPlainText(html, 'Good morning, Wendy,\n\nI hope you have been well.')).toBe(true);
  });

  it('keeps a short HTML reply in the iframe', () => {
    expect(shouldReadAsPlainText('<p>Thanks</p>', 'Thanks')).toBe(false);
  });
});

describe('threadFaceFromMessages', () => {
  it('faces the latest inbound sender, not the first person on the thread', () => {
    const face = threadFaceFromMessages(
      [
        { direction: 'inbound', from_name: '', from_address: 'dawn.marsh@bankofcolorado.com' },
        { direction: 'outbound', from_name: 'Wendy', from_address: 'wendy@payitforwardhealth.com' },
        { direction: 'inbound', from_name: '', from_address: 'frank.burnham@bankofcolorado.com' },
      ],
      { contact_name: null, contact_email: 'dawn.marsh@bankofcolorado.com' },
    );
    expect(face.email).toBe('frank.burnham@bankofcolorado.com');
    expect(face.name).toBe('Frank Burnham');
    expect(face.others.map((o) => o.email)).toEqual(['dawn.marsh@bankofcolorado.com']);
  });
});

describe('defaultMessageExpanded', () => {
  it('opens the latest inbound as well as the newest message', () => {
    const msgs = [
      { id: 'dawn', direction: 'inbound' },
      { id: 'wendy', direction: 'outbound' },
      { id: 'frank', direction: 'inbound' },
      { id: 'reply', direction: 'outbound' },
    ];
    expect(isLatestInbound(msgs, 'frank')).toBe(true);
    expect(defaultMessageExpanded(2, 4, true)).toBe(true);
    expect(defaultMessageExpanded(3, 4, false)).toBe(true);
    expect(defaultMessageExpanded(0, 4, false)).toBe(false);
  });
});
