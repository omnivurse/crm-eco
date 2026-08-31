/**
 * Pure helpers for the inbox reading pane.
 * Kept out of the React components so file-size and iframe measure
 * can be tested without mounting the thread.
 */

import createDOMPurify from 'dompurify';
import { INBOUND_BLOCKED_TAGS } from '@/lib/email/email-html-policy';

export function attachmentByteSize(att: {
  size?: unknown;
  file_size?: unknown;
}): unknown {
  return att.size ?? att.file_size;
}

/** Human size, or null when the inbound payload has no usable number. */
export function formatInboxFileSize(bytes: unknown): string | null {
  if (bytes == null || bytes === '') return null;
  const n = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** srcDoc preview: parent can measure this document. Never include allow-scripts. */
export const EMAIL_IFRAME_SANDBOX =
  'allow-popups allow-popups-to-escape-sandbox allow-same-origin';

let readingPurifier: ReturnType<typeof createDOMPurify> | null = null;

/**
 * Defense-in-depth in front of the sandboxed iframe: strip scripting vectors
 * from stored email HTML before it enters srcDoc. Uses a dedicated DOMPurify
 * instance so the hook forcing target=_blank + rel=noopener on links (which
 * neutralizes window.opener through the allow-popups-to-escape-sandbox path)
 * never leaks into other DOMPurify users (signature previews, notes).
 */
export function sanitizeEmailForReading(html: string): string {
  if (typeof window === 'undefined') return html;
  if (!readingPurifier) {
    readingPurifier = createDOMPurify(window);
    readingPurifier.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }
  return readingPurifier.sanitize(html, {
    FORBID_TAGS: [...INBOUND_BLOCKED_TAGS],
    // DOMPurify's default scheme list plus cid: and data: for inline images.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|callto|sms|cid|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

export function measureEmailDocument(doc: {
  body?: { scrollHeight?: number; offsetHeight?: number } | null;
  documentElement?: { scrollHeight?: number; offsetHeight?: number } | null;
}): number {
  const body = doc.body;
  const html = doc.documentElement;
  const height = Math.max(
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    html?.scrollHeight ?? 0,
    html?.offsetHeight ?? 0,
  );
  return Math.max(80, height + 16);
}

/**
 * Tall reading-pane floor: most of the leftover thread pane, capped at 70vh.
 * Short mail still fills the pane; taller mail grows past this.
 */
export function readingPaneFloor(
  paneHeightPx: number,
  viewportHeightPx: number,
): number {
  const vh70 = Math.max(0, viewportHeightPx) * 0.7;
  const pane =
    Number.isFinite(paneHeightPx) && paneHeightPx > 0 ? paneHeightPx : vh70;
  return Math.max(240, Math.round(Math.min(vh70, pane * 0.92)));
}

export function emailIframeHeight(measuredPx: number, paneFloorPx: number): number {
  const measured = Number.isFinite(measuredPx) ? measuredPx : 80;
  const floor = Number.isFinite(paneFloorPx) ? paneFloorPx : 240;
  return Math.max(80, measured, floor);
}
