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

/**
 * Extracts the best author name for a note.
 * - Prefers the linked profile (modern notes created inside the app).
 * - Falls back to parsing legacy trailing attributions from imported Zoho note bodies
 *   (patterns like " - Kelly Cheever", " – KC", " — Wendy Scipione - Title").
 */
function extractAuthorName(note: {
  author?: { full_name?: string | null } | null;
  body?: string | null;
}): string {
  const linked = note.author?.full_name?.trim();
  if (linked) return linked;

  const plain = (note.body || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Match trailing dash/en-dash/em-dash followed by a plausible name.
  // Capture stops before a second dash (usually a title or location).
  const match = plain.match(/[-–—]\s+([A-Z][A-Za-z][A-Za-z\s\.]{1,50}?)(?:\s*[-–—].*)?$/);
  if (match?.[1]) {
    return match[1].trim();
  }

  return '';
}

/** Always returns a clean author name (no "Historical" prefix). Useful for search/filter. */
export function getNoteAuthorName(note: {
  author?: { full_name?: string | null } | null;
  body?: string | null;
}): string {
  return extractAuthorName(note) || 'Historical note';
}

/**
 * Returns the display name for a note's author.
 * When `showHistorical` is true and the name came from legacy attribution (no linked profile),
 * the result is prefixed with "Historical • " (e.g. "Historical • Kelly Cheever").
 */
export function getNoteAuthorDisplay(
  note: { author?: { full_name?: string | null } | null; body?: string | null },
  opts?: { showHistorical?: boolean }
): string {
  const linked = note.author?.full_name?.trim();
  if (linked) return linked;

  const extracted = extractAuthorName(note);
  if (extracted) {
    return opts?.showHistorical ? `Historical • ${extracted}` : extracted;
  }

  return 'Historical note';
}

/**
 * Strips a trailing author attribution from a plain-text preview of a legacy note
 * so the preview body doesn't redundantly end with the name (the byline above will show it).
 */
export function stripLegacyAuthorAttribution(plain: string): string {
  return plain.replace(/\s*[-–—]\s+[A-Z][A-Za-z][A-Za-z\s\.]{1,50}?(?:\s*[-–—].*)?$/, '').trim();
}
