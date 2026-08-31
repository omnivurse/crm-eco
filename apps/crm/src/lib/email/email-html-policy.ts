// ============================================================================
// Email HTML policy — the single source of truth for what markup is allowed
// in email bodies, in two profiles:
//
//   outbound (strict): applied by the server inside sendEmail() before any
//     provider payload is built. The composer emits a small closed set of
//     markup; anything else (hand-edited Source mode, template imports) is
//     reduced to this set.
//
//   inbound (permissive-but-inert): applied at render time in front of the
//     reading-pane iframe. Keeps real-world newsletter markup (tables, inline
//     styles, images) but removes every scripting vector. The iframe sandbox
//     (no allow-scripts) remains the second layer of defense.
//
// Both profiles are exported as sanitize-html option objects. The client-side
// DOMPurify config for the reading pane is derived from INBOUND_BLOCKED_TAGS /
// URI schemes below so the two stay in sync (see email-sanitize.test.ts).
// ============================================================================

import type sanitizeHtml from 'sanitize-html';

export const ALLOWED_URL_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/** Tags the outbound (composer) profile permits — the compiled editor set. */
export const OUTBOUND_ALLOWED_TAGS = [
  'p', 'br', 'div', 'span',
  'h1', 'h2', 'h3',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'mark', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code', 'hr',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
];

/** Inline style properties the outbound profile keeps (value-validated). */
export const OUTBOUND_ALLOWED_STYLES: Record<string, RegExp[]> = {
  color: [/^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|[a-zA-Z]+)$/],
  'background-color': [/^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|[a-zA-Z]+)$/],
  'font-family': [/^[\w\s,'"–-]+$/],
  'font-size': [/^\d+(\.\d+)?(px|pt|em|rem|%)$/],
  'font-weight': [/^(normal|bold|[1-9]00)$/],
  'font-style': [/^(normal|italic)$/],
  'text-align': [/^(left|right|center|justify)$/],
  'text-decoration': [/^[\w\s-]+$/],
  'line-height': [/^\d+(\.\d+)?(px|em|%)?$/],
  width: [/^\d+(\.\d+)?(px|%)$/],
  height: [/^\d+(\.\d+)?(px|%)$/],
  'max-width': [/^\d+(\.\d+)?(px|%)$/],
  margin: [/^[\d\s.pxem%auto-]+$/],
  padding: [/^[\d\s.pxem%]+$/],
  'padding-left': [/^\d+(\.\d+)?(px|em|%)$/],
  border: [/^[\w\s#().,%-]+$/],
  'border-top': [/^[\w\s#().,%-]+$/],
  'border-left': [/^[\w\s#().,%-]+$/],
  'border-collapse': [/^(collapse|separate)$/],
  'vertical-align': [/^(top|middle|bottom|baseline)$/],
  'border-radius': [/^[\d\s.pxem%]+$/],
};

/**
 * sanitize-html options for OUTBOUND email HTML (composer → provider).
 * data: image URIs are currently allowed because the TipTap composer still
 * permits base64 pasted images; revisit when paste-upload lands.
 */
export const OUTBOUND_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: OUTBOUND_ALLOWED_TAGS,
  allowedAttributes: {
    '*': ['style', 'data-crm-signature', 'data-crm-quote', 'data-merge-field', 'data-field-key'],
    a: ['href', 'target', 'rel', 'style'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    td: ['colspan', 'rowspan', 'style'],
    th: ['colspan', 'rowspan', 'style'],
    col: ['span', 'style'],
    ol: ['start', 'type', 'style'],
  },
  allowedStyles: { '*': OUTBOUND_ALLOWED_STYLES },
  allowedSchemes: ALLOWED_URL_SCHEMES,
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer' },
    }),
  },
};

/** Tags always removed from inbound mail (with their content where noted). */
export const INBOUND_BLOCKED_TAGS = [
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'form', 'input', 'button', 'select', 'textarea', 'base', 'link', 'meta',
  'svg', 'math', 'template', 'dialog', 'audio', 'video', 'source', 'track',
];

/**
 * sanitize-html options for INBOUND email HTML (webhook/store → reading pane).
 * Deliberately permissive on layout markup and inline styles: real-world email
 * HTML is pathological, and the goal is inertness, not tidiness.
 */
export const INBOUND_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // Everything sanitize-html considers safe, plus email-layout staples.
  allowedTags: false as unknown as string[],
  nonBooleanAttributes: [],
  disallowedTagsMode: 'discard',
  // The blocked tags are removed by exclusiveFilter below (verified by
  // email-sanitize.test.ts); this flag only silences sanitize-html's warning
  // about allowedTags:false nominally including script/style.
  allowVulnerableTags: true,
  exclusiveFilter: (frame) => INBOUND_BLOCKED_TAGS.includes(frame.tag),
  allowedAttributes: {
    '*': [
      'style', 'align', 'valign', 'width', 'height', 'border', 'cellpadding',
      'cellspacing', 'bgcolor', 'color', 'dir', 'lang', 'title', 'role',
      'colspan', 'rowspan', 'face', 'size',
    ],
    a: ['href', 'name', 'target', 'rel', 'style'],
    img: ['src', 'alt', 'width', 'height', 'style', 'border'],
  },
  // No allowedStyles: with the property left undefined, inline styles pass
  // through untouched — acceptable because the iframe sandbox blocks scripts.
  allowedSchemes: ALLOWED_URL_SCHEMES,
  allowedSchemesByTag: { img: ['http', 'https', 'data', 'cid'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};
