export const PUBLIC_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

const ASSET_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPublicAssetId(id: string): boolean {
  return ASSET_ID_RE.test(id);
}

export function sanitizeEmailAssetFolder(folder: string | null | undefined): string {
  const cleaned = (folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'general';
}

export function buildPublicEmailAssetUrl(origin: string, id: string): string {
  return `${origin.replace(/\/$/, '')}/api/email/public-assets/${id}`;
}

export function publicAssetOriginFromRequest(origin: string): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    origin
  ).replace(/\/$/, '');
}

export function canServePublicEmailAsset(asset: {
  is_public?: boolean | null;
  mime_type?: string | null;
  bucket_path?: string | null;
  file_path?: string | null;
} | null): { ok: true; path: string; mime: string } | { ok: false } {
  if (!asset || asset.is_public !== true) return { ok: false };
  const mime = (asset.mime_type || '').toLowerCase();
  if (!PUBLIC_IMAGE_MIME_TYPES.includes(mime as (typeof PUBLIC_IMAGE_MIME_TYPES)[number])) {
    return { ok: false };
  }
  const path = asset.bucket_path || asset.file_path;
  if (!path) return { ok: false };
  return { ok: true, path, mime };
}
