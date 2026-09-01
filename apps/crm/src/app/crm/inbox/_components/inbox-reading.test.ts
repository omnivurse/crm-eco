import { describe, expect, it } from 'vitest';
import {
  EMAIL_IFRAME_SANDBOX,
  attachmentByteSize,
  emailIframeHeight,
  formatInboxFileSize,
  measureEmailDocument,
  shouldFollowNewMessages,
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
