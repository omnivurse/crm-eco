import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIFH_LOGO_PATH,
  buildPifhSignatureFromProfile,
  renderFullImageSignature,
  renderLayoutHtml,
} from './signature-html';
import {
  DEFAULT_SIGNATURE_LOGO_HEIGHT,
  MAX_SIGNATURE_LOGO_HEIGHT,
  MIN_SIGNATURE_LOGO_HEIGHT,
  applyImageToSignature,
  clampSignatureLogoHeight,
  parseApplySignatureImageBody,
  readSignatureLogoHeight,
  resizeSignatureImage,
} from './apply-signature-image';

const LOGO = 'https://crm.example.com/api/email/public-assets/11111111-1111-4111-8111-111111111111';
const PHOTO = 'https://crm.example.com/api/email/public-assets/22222222-2222-4222-8222-222222222222';
const ASSET_ID = '11111111-1111-4111-8111-111111111111';
const SIGNATURE_ID = '33333333-3333-4333-8333-333333333333';

const horizontal = buildPifhSignatureFromProfile({
  full_name: 'Wendy Scipione',
  logo_url: DEFAULT_PIFH_LOGO_PATH,
});

describe('clampSignatureLogoHeight', () => {
  it('keeps a normal size', () => {
    expect(clampSignatureLogoHeight(72)).toBe(72);
  });

  it('clamps and rounds', () => {
    expect(clampSignatureLogoHeight(1)).toBe(MIN_SIGNATURE_LOGO_HEIGHT);
    expect(clampSignatureLogoHeight(999)).toBe(MAX_SIGNATURE_LOGO_HEIGHT);
    expect(clampSignatureLogoHeight(51.6)).toBe(52);
    expect(clampSignatureLogoHeight('nope')).toBe(DEFAULT_SIGNATURE_LOGO_HEIGHT);
  });
});

describe('resizeSignatureImage', () => {
  it('rewrites the logo height attribute and max-height for Outlook-safe email', () => {
    const next = resizeSignatureImage(horizontal, 72, { matchSrc: DEFAULT_PIFH_LOGO_PATH });
    expect(next).toContain(`src="${DEFAULT_PIFH_LOGO_PATH}"`);
    expect(next).toContain('height="72"');
    expect(next).toContain('max-height: 72px');
    expect(next).not.toContain('height="52"');
    expect(next).not.toContain('max-height: 52px');
    expect(next).toContain('Wendy Scipione');
  });

  it('keeps photo crop styles when resizing a square headshot', () => {
    const html =
      '<img src="https://x/p.jpg" alt="Photo" width="80" height="80" style="border-radius: 50%; display: block;" />';
    const next = resizeSignatureImage(html, 64, { matchSrc: 'https://x/p.jpg', square: true });
    expect(next).toContain('height="64"');
    expect(next).toContain('width="64"');
    expect(next).toContain('border-radius: 50%');
  });

  it('is a no-op when the signature has no image', () => {
    expect(resizeSignatureImage('<p>Ada Lovelace</p>', 72)).toBe('<p>Ada Lovelace</p>');
  });

  it('reads the current logo height from stored HTML', () => {
    const resized = resizeSignatureImage(horizontal, 96);
    expect(readSignatureLogoHeight(resized, DEFAULT_PIFH_LOGO_PATH)).toBe(96);
    expect(readSignatureLogoHeight('<p>none</p>')).toBeNull();
  });
});

describe('applyImageToSignature', () => {
  it('replaces the default PIFH logo path and can size it in one pass', () => {
    const result = applyImageToSignature({
      slot: 'logo',
      imageUrl: LOGO,
      contentHtml: horizontal,
      logoUrl: DEFAULT_PIFH_LOGO_PATH,
      logoHeight: 72,
    });
    expect(result.logo_url).toBe(LOGO);
    expect(result.content_html).toContain(LOGO);
    expect(result.content_html).not.toContain(DEFAULT_PIFH_LOGO_PATH);
    expect(result.content_html).toContain('height="72"');
    expect(result.content_html).toContain('Wendy Scipione');
  });

  it('prepends a logo when the layout is text-only', () => {
    const result = applyImageToSignature({
      slot: 'logo',
      imageUrl: LOGO,
      imageAlt: 'PIFH',
      contentHtml: '<p><strong>Ada Lovelace</strong></p>',
    });
    expect(result.content_html).toContain(`src="${LOGO}"`);
    expect(result.content_html).toContain('Ada Lovelace');
  });

  it('does not replace the company logo when applying a photo', () => {
    const result = applyImageToSignature({
      slot: 'photo',
      imageUrl: PHOTO,
      contentHtml: horizontal,
      logoUrl: DEFAULT_PIFH_LOGO_PATH,
      photoUrl: '',
    });
    expect(result.photo_url).toBe(PHOTO);
    expect(result.logo_url).toBe(DEFAULT_PIFH_LOGO_PATH);
    expect(result.content_html).toContain(DEFAULT_PIFH_LOGO_PATH);
    expect(result.content_html).not.toContain(PHOTO);
  });

  it('swaps a professional-layout photo', () => {
    const html = renderLayoutHtml('professional', {
      full_name: 'Ada',
      title: '',
      email: '',
      phone: '',
      company_name: '',
      website: '',
      logo_url: DEFAULT_PIFH_LOGO_PATH,
      photo_url: 'https://old.example/photo.jpg',
    });
    const result = applyImageToSignature({
      slot: 'photo',
      imageUrl: PHOTO,
      contentHtml: html || '',
      photoUrl: 'https://old.example/photo.jpg',
      logoHeight: 64,
    });
    expect(result.content_html).toContain(PHOTO);
    expect(result.content_html).not.toContain('https://old.example/photo.jpg');
    expect(result.content_html).toContain('height="64"');
    expect(result.content_html).toContain('width="64"');
  });

  it('preserves a professional-layout photo when applying a logo', () => {
    const oldPhoto = 'https://old.example/photo.jpg';
    const html = renderLayoutHtml('professional', {
      full_name: 'Ada',
      title: '',
      email: '',
      phone: '',
      company_name: '',
      website: '',
      logo_url: '',
      photo_url: oldPhoto,
    });
    const result = applyImageToSignature({
      slot: 'logo',
      imageUrl: LOGO,
      contentHtml: html || '',
      logoUrl: '',
      photoUrl: oldPhoto,
      logoHeight: 72,
    });

    expect(result.logo_url).toBe(LOGO);
    expect(result.photo_url).toBe(oldPhoto);
    expect(result.content_html).toContain(`src="${LOGO}"`);
    expect(result.content_html).toContain(`src="${oldPhoto}"`);
    expect(result.content_html).toContain('height="72"');
    expect(result.content_html).toContain('width="80"');
  });

  it('replaces the whole block for a full-image signature', () => {
    const result = applyImageToSignature({
      slot: 'full',
      imageUrl: LOGO,
      imageAlt: 'Email Signature',
      contentHtml: horizontal,
      logoHeight: 120,
    });
    expect(result.content_html).toBe(
      resizeSignatureImage(renderFullImageSignature(LOGO, 'Email Signature'), 120, {
        matchSrc: LOGO,
      }),
    );
    expect(result.logo_url).toBe(LOGO);
  });

  it('rejects a blank image URL', () => {
    expect(() =>
      applyImageToSignature({
        slot: 'logo',
        imageUrl: '   ',
        contentHtml: horizontal,
      }),
    ).toThrow('Image URL is required');
  });
});

describe('parseApplySignatureImageBody', () => {
  it('accepts a team apply with an optional size', () => {
    expect(
      parseApplySignatureImageBody({
        assetId: ASSET_ID,
        signatureId: SIGNATURE_ID,
        slot: 'logo',
        logoHeight: 80,
      }),
    ).toEqual({
      ok: true,
      assetId: ASSET_ID,
      signatureId: SIGNATURE_ID,
      slot: 'logo',
      createIfMissing: false,
      logoHeight: 80,
    });
  });

  it('allows create-own when no signature exists yet', () => {
    const parsed = parseApplySignatureImageBody({
      assetId: ASSET_ID,
      slot: 'full',
      createIfMissing: true,
    });
    expect(parsed).toMatchObject({ ok: true, signatureId: null, createIfMissing: true });
  });

  it('rejects a missing signature without createIfMissing', () => {
    expect(parseApplySignatureImageBody({ assetId: ASSET_ID, slot: 'logo' })).toEqual({
      ok: false,
      error: 'Choose a signature',
    });
  });

  it('rejects a bad asset id', () => {
    expect(
      parseApplySignatureImageBody({
        assetId: 'not-a-uuid',
        signatureId: SIGNATURE_ID,
        slot: 'logo',
      }),
    ).toMatchObject({ ok: false });
  });
});
