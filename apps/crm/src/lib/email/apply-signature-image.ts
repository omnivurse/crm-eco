import { isValidPublicAssetId } from '@/lib/email/public-email-asset';
import {
  DEFAULT_PIFH_LOGO_PATH,
  EMPTY_SIGNATURE_FIELDS,
  buildPifhSignatureFromProfile,
  escapeHtml,
  renderFullImageSignature,
  renderLayoutHtml,
} from '@/lib/email/signature-html';

export const SIGNATURE_IMAGE_SLOTS = ['logo', 'photo', 'full'] as const;
export type SignatureImageSlot = (typeof SIGNATURE_IMAGE_SLOTS)[number];

export const MIN_SIGNATURE_LOGO_HEIGHT = 24;
export const MAX_SIGNATURE_LOGO_HEIGHT = 160;
export const DEFAULT_SIGNATURE_LOGO_HEIGHT = 52;

export const SIGNATURE_LOGO_SIZE_PRESETS = [
  { id: 'small', label: 'Small', height: 36 },
  { id: 'default', label: 'Default', height: 52 },
  { id: 'large', label: 'Large', height: 72 },
  { id: 'xl', label: 'XL', height: 96 },
] as const;

export function isSignatureImageSlot(value: unknown): value is SignatureImageSlot {
  return typeof value === 'string' && (SIGNATURE_IMAGE_SLOTS as readonly string[]).includes(value);
}

export function clampSignatureLogoHeight(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SIGNATURE_LOGO_HEIGHT;
  return Math.min(MAX_SIGNATURE_LOGO_HEIGHT, Math.max(MIN_SIGNATURE_LOGO_HEIGHT, Math.round(n)));
}

export type ApplySignatureImageInput = {
  slot: SignatureImageSlot;
  imageUrl: string;
  imageAlt?: string;
  contentHtml: string;
  logoUrl?: string | null;
  photoUrl?: string | null;
  logoHeight?: number | null;
};

export type AppliedSignatureImage = {
  content_html: string;
  logo_url: string | null;
  photo_url: string | null;
};

function collectUrlTargets(primary: string | null | undefined, extras: string[] = []): string[] {
  const urls = new Set<string>();
  for (const value of [primary, ...extras]) {
    const trimmed = value?.trim();
    if (trimmed) urls.add(trimmed);
  }
  return [...urls];
}

function replaceLiteralUrls(
  html: string,
  oldUrls: string[],
  newUrl: string,
): { html: string; replaced: boolean } {
  let next = html;
  let replaced = false;
  for (const oldUrl of oldUrls) {
    if (!oldUrl || oldUrl === newUrl) continue;
    if (next.includes(oldUrl)) {
      next = next.split(oldUrl).join(newUrl);
      replaced = true;
    }
  }
  return { html: next, replaced };
}

const FIRST_IMG_SRC_RE = /(<img\b[^>]*\bsrc=)(["'])([^"']*)(\2)/i;

function replaceFirstImgSrc(html: string, newUrl: string): { html: string; replaced: boolean } {
  if (!FIRST_IMG_SRC_RE.test(html)) return { html, replaced: false };
  const next = html.replace(FIRST_IMG_SRC_RE, `$1$2${newUrl}$4`);
  return { html: next, replaced: next !== html };
}

function prependLogoImg(html: string, url: string, alt: string): string {
  const src = escapeHtml(url);
  const label = escapeHtml(alt);
  return `<p style="margin:0 0 8px 0;"><img src="${src}" alt="${label}" height="${DEFAULT_SIGNATURE_LOGO_HEIGHT}" style="display: block; max-height: ${DEFAULT_SIGNATURE_LOGO_HEIGHT}px; width: auto;" /></p>\n${html}`;
}

function findImgTags(html: string): string[] {
  return html.match(/<img\b[^>]*>/gi) ?? [];
}

function pickSignatureImg(html: string, matchSrc?: string | null): string | null {
  const tags = findImgTags(html);
  if (tags.length === 0) return null;
  for (const target of collectUrlTargets(matchSrc, [DEFAULT_PIFH_LOGO_PATH])) {
    const found = tags.find((tag) => tag.includes(target));
    if (found) return found;
  }
  return tags[0] ?? null;
}

function upsertInlineStyle(style: string, updates: Record<string, string>): string {
  const map = new Map<string, string>();
  for (const part of style.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const splitAt = trimmed.indexOf(':');
    if (splitAt === -1) continue;
    map.set(trimmed.slice(0, splitAt).trim().toLowerCase(), trimmed.slice(splitAt + 1).trim());
  }
  for (const [key, value] of Object.entries(updates)) {
    const name = key.toLowerCase();
    if (value === '') map.delete(name);
    else map.set(name, value);
  }
  return [...map.entries()].map(([key, value]) => `${key}: ${value}`).join('; ');
}

function rewriteImgSize(tag: string, heightPx: number, square: boolean): string {
  const height = String(heightPx);
  let next = tag;

  if (/\bheight\s*=/i.test(next)) {
    next = next.replace(/\bheight\s*=\s*(["']?)\d+\1/i, `height="${height}"`);
  } else {
    next = next.replace(/<img\b/i, `<img height="${height}"`);
  }

  if (square) {
    if (/\bwidth\s*=/i.test(next)) {
      next = next.replace(/\bwidth\s*=\s*(["']?)\d+\1/i, `width="${height}"`);
    } else {
      next = next.replace(/<img\b/i, `<img width="${height}"`);
    }
  } else {
    next = next.replace(/\s*\bwidth\s*=\s*(["']?)\d+\1/i, '');
  }

  const styleUpdates: Record<string, string> = square
    ? {
        display: 'block',
        height: `${height}px`,
        width: `${height}px`,
        'max-height': `${height}px`,
        'max-width': `${height}px`,
      }
    : {
        display: 'block',
        height: 'auto',
        width: 'auto',
        'max-height': `${height}px`,
      };

  if (/\bstyle\s*=/i.test(next)) {
    next = next.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i, (_match, quote: string, style: string) => {
      return `style=${quote}${upsertInlineStyle(style, styleUpdates)}${quote}`;
    });
  } else {
    const style = upsertInlineStyle('', styleUpdates);
    next = next.replace(/<img\b/i, `<img style="${style}"`);
  }

  return next;
}

export function readSignatureLogoHeight(
  html: string | null | undefined,
  matchSrc?: string | null,
): number | null {
  const tag = pickSignatureImg(html || '', matchSrc);
  if (!tag) return null;
  const heightAttr = tag.match(/\bheight\s*=\s*(["']?)(\d+)\1/i);
  if (heightAttr) return clampSignatureLogoHeight(Number(heightAttr[2]));
  const maxHeight = tag.match(/max-height\s*:\s*(\d+)px/i);
  if (maxHeight) return clampSignatureLogoHeight(Number(maxHeight[1]));
  return null;
}

export function resizeSignatureImage(
  html: string,
  heightPx: number,
  opts?: { matchSrc?: string | null; square?: boolean },
): string {
  const height = clampSignatureLogoHeight(heightPx);
  const tag = pickSignatureImg(html, opts?.matchSrc);
  if (!tag) return html;
  return html.replace(tag, rewriteImgSize(tag, height, opts?.square === true));
}

export function applyImageToSignature(input: ApplySignatureImageInput): AppliedSignatureImage {
  const imageUrl = input.imageUrl.trim();
  if (!imageUrl) {
    throw new Error('Image URL is required');
  }

  const alt =
    input.imageAlt?.trim() ||
    (input.slot === 'photo' ? 'Photo' : input.slot === 'full' ? 'Email Signature' : 'Logo');
  const logoUrl = input.logoUrl ?? null;
  const photoUrl = input.photoUrl ?? null;
  const contentHtml = input.contentHtml || '';

  let result: AppliedSignatureImage;

  if (input.slot === 'full') {
    result = {
      content_html: renderFullImageSignature(imageUrl, alt),
      logo_url: imageUrl,
      photo_url: photoUrl,
    };
  } else if (input.slot === 'photo') {
    let html = contentHtml;
    const photoTargets = collectUrlTargets(photoUrl).filter((url) => url !== DEFAULT_PIFH_LOGO_PATH);
    const replaced = replaceLiteralUrls(html, photoTargets, imageUrl);
    html = replaced.html;
    if (!replaced.replaced && !html.includes(imageUrl)) {
      const photoByAlt = html.match(/<img\b[^>]*\balt=(["'])Photo\1[^>]*>/i);
      if (photoByAlt) {
        html = html.replace(photoByAlt[0], photoByAlt[0].replace(FIRST_IMG_SRC_RE, `$1$2${imageUrl}$4`));
      } else if (!logoUrl || !html.includes(logoUrl)) {
        const first = replaceFirstImgSrc(html, imageUrl);
        if (first.replaced) html = first.html;
      }
    }
    result = { content_html: html, logo_url: logoUrl, photo_url: imageUrl };
  } else {
    let html = contentHtml;
    const replaced = replaceLiteralUrls(
      html,
      collectUrlTargets(logoUrl, [DEFAULT_PIFH_LOGO_PATH]),
      imageUrl,
    );
    html = replaced.html;
    if (!replaced.replaced && !html.includes(imageUrl)) {
      const firstImg = findImgTags(html)[0] ?? '';
      const firstImgIsPhoto =
        /\balt=(["'])Photo\1/i.test(firstImg) ||
        collectUrlTargets(photoUrl).some((url) => firstImg.includes(url));

      // Professional signatures contain only a headshot. Preserve that image
      // and add the requested logo instead of silently replacing the photo.
      if (firstImgIsPhoto) {
        html = prependLogoImg(html, imageUrl, alt);
      } else {
        const first = replaceFirstImgSrc(html, imageUrl);
        if (first.replaced) html = first.html;
        else html = prependLogoImg(html, imageUrl, alt);
      }
    }
    result = { content_html: html, logo_url: imageUrl, photo_url: photoUrl };
  }

  if (input.logoHeight != null) {
    result = {
      ...result,
      content_html: resizeSignatureImage(result.content_html, input.logoHeight, {
        matchSrc: input.slot === 'photo' ? result.photo_url : result.logo_url,
        square: input.slot === 'photo',
      }),
    };
  }

  return result;
}

export function buildCreatedSignatureHtml(input: {
  slot: SignatureImageSlot;
  imageUrl: string;
  imageAlt?: string;
  fullName?: string;
  logoHeight?: number | null;
}): AppliedSignatureImage {
  const imageUrl = input.imageUrl.trim();
  const alt = input.imageAlt?.trim();
  const fullName = input.fullName?.trim() || 'Signature';

  let result: AppliedSignatureImage;
  if (input.slot === 'full') {
    result = {
      content_html: renderFullImageSignature(imageUrl, alt || 'Email Signature'),
      logo_url: imageUrl,
      photo_url: null,
    };
  } else if (input.slot === 'photo') {
    result = {
      content_html:
        renderLayoutHtml('professional', {
          ...EMPTY_SIGNATURE_FIELDS,
          full_name: fullName,
          photo_url: imageUrl,
        }) ?? '',
      logo_url: null,
      photo_url: imageUrl,
    };
  } else {
    result = {
      content_html: buildPifhSignatureFromProfile({
        full_name: fullName,
        logo_url: imageUrl,
      }),
      logo_url: imageUrl,
      photo_url: null,
    };
  }

  if (input.logoHeight != null) {
    result = {
      ...result,
      content_html: resizeSignatureImage(result.content_html, input.logoHeight, {
        matchSrc: input.slot === 'photo' ? result.photo_url : result.logo_url,
        square: input.slot === 'photo',
      }),
    };
  }

  return result;
}

export type ParsedApplySignatureImageBody =
  | {
      ok: true;
      signatureId: string | null;
      assetId: string;
      slot: SignatureImageSlot;
      createIfMissing: boolean;
      logoHeight: number | null;
    }
  | { ok: false; error: string };

export function parseApplySignatureImageBody(body: unknown): ParsedApplySignatureImageBody {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  const rec = body as Record<string, unknown>;
  const assetId = typeof rec.assetId === 'string' ? rec.assetId : '';
  if (!isValidPublicAssetId(assetId)) {
    return { ok: false, error: 'A valid asset is required' };
  }
  if (!isSignatureImageSlot(rec.slot)) {
    return { ok: false, error: 'Choose logo, photo, or a full signature image' };
  }
  const signatureId = typeof rec.signatureId === 'string' && rec.signatureId ? rec.signatureId : null;
  if (signatureId && !isValidPublicAssetId(signatureId)) {
    return { ok: false, error: 'A valid signature is required' };
  }
  const createIfMissing = rec.createIfMissing === true;
  if (!signatureId && !createIfMissing) {
    return { ok: false, error: 'Choose a signature' };
  }
  const logoHeight =
    rec.logoHeight === undefined || rec.logoHeight === null || rec.logoHeight === ''
      ? null
      : clampSignatureLogoHeight(rec.logoHeight);
  return { ok: true, signatureId, assetId, slot: rec.slot, createIfMissing, logoHeight };
}
