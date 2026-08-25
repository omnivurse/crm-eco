import { describe, expect, it } from 'vitest';
import {
  EMAIL_IFRAME_SANDBOX,
  attachmentByteSize,
  emailIframeHeight,
  formatInboxFileSize,
  measureEmailDocument,
  readingPaneFloor,
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

describe('readingPaneFloor', () => {
  it('uses most of the leftover pane, capped at 70vh', () => {
    expect(readingPaneFloor(400, 900)).toBe(368);
    expect(readingPaneFloor(800, 900)).toBe(630);
    expect(readingPaneFloor(0, 800)).toBe(515);
  });
});

describe('emailIframeHeight', () => {
  it('grows past the pane floor when the mail is taller', () => {
    expect(emailIframeHeight(200, 500)).toBe(500);
    expect(emailIframeHeight(1200, 500)).toBe(1200);
  });
});
