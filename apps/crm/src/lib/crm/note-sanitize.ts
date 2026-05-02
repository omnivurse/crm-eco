import DOMPurify from 'dompurify';

/**
 * Allowed HTML for CRM notes (matching rich editor / paste sanitization).
 * Keeps Bold/Italic/Underline and font color ({@link FONT} tag from execCommand)
 * without allowing arbitrary `<span style>` attack surface.
 */
const NOTE_ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  'font',
  'br',
  'p',
  'div',
  'span',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'a',
  'sub',
  'sup',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
];

const NOTE_ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'color'];

export const SANITIZE_NOTE_HTML_CONFIG = {
  ALLOWED_TAGS: NOTE_ALLOWED_TAGS,
  ALLOWED_ATTR: NOTE_ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ADD_TAGS: ['img'],
  ADD_ATTR: ['src', 'alt', 'width', 'height'],
};

/** Sanitize note HTML before persistence or XSS-safe display (client-safe). */
export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_NOTE_HTML_CONFIG);
}
