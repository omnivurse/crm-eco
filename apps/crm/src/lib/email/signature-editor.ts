import {
  applyImageToSignature,
  resizeSignatureImage,
  type SignatureImageSlot,
} from '@/lib/email/apply-signature-image';
import {
  DEFAULT_PIFH_LOGO_PATH,
  OFFICIAL_SIGNATURES,
  SIGNATURE_LAYOUTS,
  type SignatureFields,
  isOfficialSignatureId,
  renderFullImageSignature,
  renderLayoutHtml,
  renderOfficialSignatureWithFields,
} from '@/lib/email/signature-html';

export type EditorLayoutId = string | null;

function unescapeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function textFromHtml(value: string): string {
  return unescapeHtml(value.replace(/<[^>]+>/g, ' '));
}

function imgSrcs(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc=(["'])([^"']*)\1/gi)].map((match) => match[2]);
}

function includesAll(source: string, fingerprints: string[]): boolean {
  return fingerprints.every((fingerprint) => source.includes(fingerprint));
}

export function detectSignatureLayout(html: string | null | undefined): EditorLayoutId {
  const source = html || '';
  if (!source.trim()) return null;

  const markedLayout = source.match(/\bdata-signature-layout=(["'])([^"']+)\1/i)?.[2];
  if (markedLayout && SIGNATURE_LAYOUTS.some((layout) => layout.id === markedLayout)) {
    return markedLayout;
  }

  for (const mark of OFFICIAL_SIGNATURES) {
    if (source.includes(mark.image_path) || source.includes(mark.image_path.replace(/^\//, ''))) {
      return mark.id;
    }
  }
  if (
    includesAll(source, [
      'border-left: 3px solid #12A065',
      'padding-right: 16px',
      'padding-left: 16px',
    ])
  ) {
    return 'pifh-horizontal';
  }
  if (
    includesAll(source, [
      'border-top: 2px solid #0E8C9A',
      'padding-bottom: 12px',
      'padding-top: 12px',
    ])
  ) {
    return 'pifh-stacked';
  }
  if (
    includesAll(source, [
      'background: #003A5C',
      'border: 1px solid #D5E5EF',
      'border-top: none',
    ])
  ) {
    return 'pifh-branded';
  }
  if (
    includesAll(source, ['border-radius: 50%', 'border-right: 2px solid #0E8C9A']) &&
    /alt=(["'])Photo\1/i.test(source)
  ) {
    return 'professional';
  }
  if (
    includesAll(source, [
      '&nbsp;·&nbsp;',
      '>Email</a>',
      '>Phone</a>',
      '>Website</a>',
    ])
  ) {
    return 'modern';
  }

  const srcs = imgSrcs(source);
  const text = textFromHtml(source);
  if (srcs.length === 1 && text.length === 0) return 'full-image';

  return null;
}

export function extractSignatureFields(
  html: string | null | undefined,
  fallback: SignatureFields,
): SignatureFields {
  const source = html || '';
  if (!source.trim()) return fallback;

  const srcs = imgSrcs(source);
  const photoTag = source.match(/<img\b[^>]*\balt=(["'])Photo\1[^>]*>/i)?.[0] ?? '';
  const photoSrc = photoTag.match(/\bsrc=(["'])([^"']*)\1/i)?.[2] ?? '';
  const logoSrc = srcs.find((src) => src && src !== photoSrc) || srcs[0] || '';

  const mailto = unescapeHtml(source.match(/mailto:([^"'>\s]+)/i)?.[1] || '');
  const tel = unescapeHtml(source.match(/tel:([^"'>\s]+)/i)?.[1] || '');
  const websiteHref = unescapeHtml(
    source.match(/\bhref=(["'])((?:https?:\/\/|www\.)[^"']+)\1/i)?.[2] || '',
  );
  const website =
    websiteHref.replace(/^https?:\/\//i, '') ||
    unescapeHtml(source.match(/>([a-z0-9.-]+\.[a-z]{2,})<\/a>/i)?.[1] || '');
  const hasWebsiteHref = /<a\b[^>]*\bhref=/i.test(source);

  const paragraphs = [...source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) =>
    textFromHtml(match[1]),
  );
  const name =
    unescapeHtml(source.match(/font-weight:\s*bold[^>]*>([^<]+)</i)?.[1] || '') ||
    unescapeHtml(source.match(/<strong>([^<]+)<\/strong>/i)?.[1] || '') ||
    paragraphs[0] ||
    '';

  const emailPhone = source.match(
    />([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\s*\|\s*([^<]+)</i,
  );
  const email = mailto || unescapeHtml(emailPhone?.[1] || '');
  const phone = tel || unescapeHtml(emailPhone?.[2] || '');

  const leftover = paragraphs.filter(
    (text) =>
      text &&
      text !== name &&
      text !== email &&
      text !== phone &&
      text !== `${email} | ${phone}` &&
      text !== website,
  );

  return {
    full_name: name || fallback.full_name,
    title: leftover[0] || fallback.title,
    email: email || fallback.email,
    phone: phone || fallback.phone,
    company_name: leftover[1] || fallback.company_name,
    website: website || (hasWebsiteHref ? '' : fallback.website),
    logo_url: logoSrc || fallback.logo_url || DEFAULT_PIFH_LOGO_PATH,
    photo_url: photoSrc || fallback.photo_url,
  };
}

export function renderEditorSignatureHtml(
  layoutId: EditorLayoutId,
  fields: SignatureFields,
  fallbackHtml: string,
): string {
  if (layoutId === 'full-image') {
    const url = fields.logo_url.trim();
    if (!url) return fallbackHtml;
    return renderFullImageSignature(url, fields.company_name || 'Email Signature');
  }
  if (isOfficialSignatureId(layoutId)) {
    return renderOfficialSignatureWithFields(layoutId || '', fields) || fallbackHtml;
  }
  if (layoutId) {
    return renderLayoutHtml(layoutId, fields) || fallbackHtml;
  }
  return fallbackHtml;
}

export function sizeEditorSignatureHtml(
  html: string,
  layoutId: EditorLayoutId,
  fields: SignatureFields,
  logoHeight: number,
): string {
  if (!html) return html;
  const matchSrc =
    layoutId === 'professional' ? fields.photo_url : fields.logo_url || undefined;
  return resizeSignatureImage(html, logoHeight, {
    matchSrc,
    square: layoutId === 'professional',
  });
}

export function applyEditorSignatureImage(input: {
  slot: SignatureImageSlot;
  url: string;
  alt?: string;
  layoutId: EditorLayoutId;
  fields: SignatureFields;
  contentHtml: string;
  logoHeight: number;
}): { layoutId: EditorLayoutId; fields: SignatureFields; content_html: string } {
  const url = input.url.trim();
  if (input.slot === 'full') {
    const fields = { ...input.fields, logo_url: url };
    const html = sizeEditorSignatureHtml(
      renderFullImageSignature(url, input.alt || 'Email Signature'),
      'full-image',
      fields,
      input.logoHeight,
    );
    return { layoutId: 'full-image', fields, content_html: html };
  }

  const fields =
    input.slot === 'photo'
      ? { ...input.fields, photo_url: url }
      : { ...input.fields, logo_url: url };

  // Official marks are canned artwork. An upload must not reset to that artwork.
  if (isOfficialSignatureId(input.layoutId)) {
    const layoutId = input.slot === 'photo' ? 'professional' : 'pifh-stacked';
    const html = sizeEditorSignatureHtml(
      renderEditorSignatureHtml(layoutId, fields, input.contentHtml),
      layoutId,
      fields,
      input.logoHeight,
    );
    return { layoutId, fields, content_html: html };
  }

  if (input.layoutId && input.layoutId !== 'full-image') {
    const html = sizeEditorSignatureHtml(
      renderEditorSignatureHtml(input.layoutId, fields, input.contentHtml),
      input.layoutId,
      fields,
      input.logoHeight,
    );
    return { layoutId: input.layoutId, fields, content_html: html };
  }

  const applied = applyImageToSignature({
    slot: input.slot,
    imageUrl: url,
    imageAlt: input.alt,
    contentHtml: input.contentHtml,
    logoUrl: input.fields.logo_url,
    photoUrl: input.fields.photo_url,
    logoHeight: input.logoHeight,
  });
  return {
    layoutId: input.layoutId,
    fields: {
      ...fields,
      logo_url: applied.logo_url || fields.logo_url,
      photo_url: applied.photo_url || fields.photo_url,
    },
    content_html: applied.content_html,
  };
}
