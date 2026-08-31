import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest } from '@/test/helpers';

const mockFrom = vi.fn();
const mockDownload = vi.fn();

vi.mock('@crm-eco/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: () => ({
        download: (...args: unknown[]) => mockDownload(...args),
      }),
    },
  }),
}));

import { GET } from './route';

const PUBLIC_ID = '11111111-1111-4111-8111-111111111111';

function chainResult(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return builder;
}

describe('GET /api/email/public-assets/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for an invalid id', async () => {
    const res = await GET(buildRequest('http://localhost/api/email/public-assets/nope'), {
      params: Promise.resolve({ id: 'nope' }),
    });
    expect(res.status).toBe(404);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 404 when the asset is not public', async () => {
    mockFrom.mockReturnValue(
      chainResult({
        data: {
          id: PUBLIC_ID,
          org_id: 'org-1',
          is_public: false,
          mime_type: 'image/png',
          bucket_path: 'org-1/signatures/logo.png',
        },
        error: null,
      }),
    );

    const res = await GET(buildRequest(`http://localhost/api/email/public-assets/${PUBLIC_ID}`), {
      params: Promise.resolve({ id: PUBLIC_ID }),
    });
    expect(res.status).toBe(404);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-image asset', async () => {
    mockFrom.mockReturnValue(
      chainResult({
        data: {
          id: PUBLIC_ID,
          org_id: 'org-1',
          is_public: true,
          mime_type: 'application/pdf',
          bucket_path: 'org-1/signatures/file.pdf',
        },
        error: null,
      }),
    );

    const res = await GET(buildRequest(`http://localhost/api/email/public-assets/${PUBLIC_ID}`), {
      params: Promise.resolve({ id: PUBLIC_ID }),
    });
    expect(res.status).toBe(404);
  });

  it('streams a public image', async () => {
    mockFrom.mockReturnValue(
      chainResult({
        data: {
          id: PUBLIC_ID,
          org_id: 'org-1',
          is_public: true,
          mime_type: 'image/png',
          bucket_path: 'org-1/signatures/logo.png',
        },
        error: null,
      }),
    );
    mockDownload.mockResolvedValue({
      data: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
      error: null,
    });

    const res = await GET(buildRequest(`http://localhost/api/email/public-assets/${PUBLIC_ID}`), {
      params: Promise.resolve({ id: PUBLIC_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toContain('max-age=31536000');
    expect(mockDownload).toHaveBeenCalledWith('org-1/signatures/logo.png');
  });
});
