import { describe, expect, it } from 'vitest';
import {
  buildPublicEmailAssetUrl,
  canServePublicEmailAsset,
  isValidPublicAssetId,
  sanitizeEmailAssetFolder,
} from './public-email-asset';

describe('public-email-asset', () => {
  it('accepts only UUID asset ids', () => {
    expect(isValidPublicAssetId('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isValidPublicAssetId('../etc/passwd')).toBe(false);
    expect(isValidPublicAssetId('not-a-uuid')).toBe(false);
  });

  it('serves only public raster images', () => {
    expect(
      canServePublicEmailAsset({
        is_public: true,
        mime_type: 'image/png',
        bucket_path: 'org/signatures/logo.png',
      }),
    ).toEqual({ ok: true, path: 'org/signatures/logo.png', mime: 'image/png' });

    expect(
      canServePublicEmailAsset({
        is_public: false,
        mime_type: 'image/png',
        bucket_path: 'org/signatures/logo.png',
      }),
    ).toEqual({ ok: false });

    expect(
      canServePublicEmailAsset({
        is_public: true,
        mime_type: 'application/pdf',
        bucket_path: 'org/signatures/file.pdf',
      }),
    ).toEqual({ ok: false });

    expect(
      canServePublicEmailAsset({
        is_public: true,
        mime_type: 'image/svg+xml',
        bucket_path: 'org/signatures/logo.svg',
      }),
    ).toEqual({ ok: false });
  });

  it('sanitizes upload folders and builds the public URL', () => {
    expect(sanitizeEmailAssetFolder('signatures')).toBe('signatures');
    expect(sanitizeEmailAssetFolder('../secrets')).toBe('secrets');
    expect(sanitizeEmailAssetFolder('')).toBe('general');
    expect(buildPublicEmailAssetUrl('https://crm.example.com/', '11111111-1111-4111-8111-111111111111')).toBe(
      'https://crm.example.com/api/email/public-assets/11111111-1111-4111-8111-111111111111',
    );
  });
});
