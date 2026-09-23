import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildProfile,
  buildRequest,
  buildSupabaseClient,
} from '@/test/helpers';

const JOB_ID = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-08-22T11:00:00.000Z');

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();
const mockRequireActiveOrgCrmRoles = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

vi.mock('@/lib/crm/require-crm-role', () => ({
  requireActiveOrgCrmRoles: (...args: unknown[]) =>
    mockRequireActiveOrgCrmRoles(...args),
}));

import { POST } from './route';

function makeParams() {
  return { params: Promise.resolve({ jobId: JOB_ID }) };
}

function buildJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    source_type: 'csv_update',
    status: 'processing',
    started_at: '2026-08-22T10:30:00.000Z',
    created_at: '2026-08-22T10:29:00.000Z',
    stats: {},
    ...overrides,
  };
}

function setupClient(job: ReturnType<typeof buildJob>) {
  const supabase = buildSupabaseClient(
    {
      crm_import_jobs: { data: job, error: null },
    },
    {
      rpcResults: {
        fn_rollback_csv_update: {
          data: {
            restored_count: 1,
            skipped_changed_count: 0,
            skipped_missing_count: 0,
            error_message: null,
          },
          error: null,
        },
      },
    },
  );
  mockCreateClient.mockResolvedValue(supabase.client);
  return supabase;
}

describe('POST /api/crm/imports/[jobId]/rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockRequireActiveOrgCrmRoles.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses rollback when a long-running job has a recent pass heartbeat', async () => {
    const { client, queryBuilders } = setupClient(
      buildJob({
        stats: { last_pass_at: '2026-08-22T10:59:30.000Z' },
      }),
    );

    const response = await POST(
      buildRequest(`http://localhost/api/crm/imports/${JOB_ID}/rollback`, {
        method: 'POST',
      }),
      makeParams(),
    );

    expect(response.status).toBe(409);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(queryBuilders.crm_import_jobs.select).toHaveBeenCalledWith(
      'id, source_type, status, started_at, created_at, stats',
    );
  });

  it('allows rollback only after both the start and heartbeat are stale', async () => {
    const { client } = setupClient(
      buildJob({
        stats: { last_pass_at: '2026-08-22T10:40:00.000Z' },
      }),
    );

    const response = await POST(
      buildRequest(`http://localhost/api/crm/imports/${JOB_ID}/rollback`, {
        method: 'POST',
      }),
      makeParams(),
    );

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith('fn_rollback_csv_update', {
      p_job_id: JOB_ID,
    });
  });

  it('falls back to the job start when no heartbeat exists', async () => {
    const { client } = setupClient(
      buildJob({
        started_at: '2026-08-22T10:55:00.000Z',
      }),
    );

    const response = await POST(
      buildRequest(`http://localhost/api/crm/imports/${JOB_ID}/rollback`, {
        method: 'POST',
      }),
      makeParams(),
    );

    expect(response.status).toBe(409);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
