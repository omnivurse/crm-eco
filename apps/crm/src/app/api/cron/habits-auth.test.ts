import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest } from '@/test/helpers';
import {
  GET as aggregateGet,
  POST as aggregatePost,
} from './habits-aggregate/route';
import {
  GET as aiTipsGet,
  POST as aiTipsPost,
} from './habits-ai-tips/route';

const CRON_SECRET = 'test-cron-secret';

const handlers = [
  {
    name: 'GET /api/cron/habits-aggregate',
    url: '/api/cron/habits-aggregate',
    handler: aggregateGet,
  },
  {
    name: 'POST /api/cron/habits-aggregate',
    url: '/api/cron/habits-aggregate',
    handler: aggregatePost,
  },
  {
    name: 'GET /api/cron/habits-ai-tips',
    url: '/api/cron/habits-ai-tips',
    handler: aiTipsGet,
  },
  {
    name: 'POST /api/cron/habits-ai-tips',
    url: '/api/cron/habits-ai-tips',
    handler: aiTipsPost,
  },
] as const;

describe.each(handlers)('$name authentication', ({ url, handler }) => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects spoofed Vercel cron headers without the bearer secret', async () => {
    const request = buildRequest(url, {
      headers: {
        'x-vercel-cron': '1',
        'x-vercel-cron-schedule': '0 5 * * *',
      },
    });

    const response = await handler(request);

    expect(response.status).toBe(401);
  });

  it('rejects a wrong bearer secret even with cron headers', async () => {
    const request = buildRequest(url, {
      headers: {
        authorization: 'Bearer wrong-secret',
        'x-vercel-cron': '1',
        'x-vercel-cron-schedule': '0 5 * * *',
      },
    });

    const response = await handler(request);

    expect(response.status).toBe(401);
  });

  it('accepts the configured bearer secret', async () => {
    const request = buildRequest(url, {
      headers: {
        authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    const response = await handler(request);

    // Downstream configuration may be absent in this unit test, but auth passed.
    expect(response.status).not.toBe(401);
  });
});
