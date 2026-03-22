import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const VALID_ORG_ID = '00000000-0000-0000-0000-000000000001';
const mockProfile = buildProfile({ organization_id: VALID_ORG_ID });
const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

vi.mock('@/lib/automation', () => ({
  executeMatchingWorkflows: vi.fn(() => Promise.resolve()),
  applyScoring: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/blueprints', () => ({
  getModuleBlueprint: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/lib/approvals', () => ({
  getRecordPendingApproval: vi.fn(() => Promise.resolve(null)),
  checkApprovalRequired: vi.fn(() => Promise.resolve(null)),
  createApprovalRequest: vi.fn(() => Promise.resolve({ success: false })),
}));

vi.mock('@/lib/security', () => ({
  logPHIAccess: vi.fn(() => Promise.resolve()),
  identifyPHIFields: vi.fn(() => []),
}));

import { PATCH, DELETE } from './route';
import { getModuleBlueprint } from '@/lib/blueprints';
import { getRecordPendingApproval, checkApprovalRequired, createApprovalRequest } from '@/lib/approvals';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildChainable(result: { data: unknown; error: unknown }) {
  const c: Record<string, any> = {};
  ['select', 'update', 'delete', 'eq', 'insert', 'order'].forEach(m => {
    c[m] = vi.fn(() => c);
  });
  c.single = vi.fn(() => Promise.resolve(result));
  return c;
}

describe('PATCH /api/crm/records/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', {
      method: 'PATCH',
      body: { data: {} },
    });
    const res = await PATCH(req, makeParams('rec-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewer role', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_viewer' }));
    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', {
      method: 'PATCH',
      body: { data: {} },
    });
    const res = await PATCH(req, makeParams('rec-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when record not found', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const c = buildChainable({ data: null, error: null });
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => c) });

    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', {
      method: 'PATCH',
      body: { title: 'Updated' },
    });
    const res = await PATCH(req, makeParams('rec-1'));
    expect(res.status).toBe(404);
  });

  it('blocks direct stage change when blueprint exists', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const existingRecord = { id: 'rec-1', stage: 'lead', module_id: 'mod-1', org_id: VALID_ORG_ID, data: {} };
    const c = buildChainable({ data: existingRecord, error: null });
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => c) });
    vi.mocked(getModuleBlueprint).mockResolvedValue({ id: 'bp-1' } as any);

    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', {
      method: 'PATCH',
      body: { stage: 'qualified' },
    });
    const res = await PATCH(req, makeParams('rec-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('BLUEPRINT_STAGE_PROTECTION');
  });

  it('blocks stage change when pending approval exists', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const existingRecord = { id: 'rec-1', stage: 'lead', module_id: 'mod-1', org_id: VALID_ORG_ID, data: {} };
    const c = buildChainable({ data: existingRecord, error: null });
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => c) });
    vi.mocked(getModuleBlueprint).mockResolvedValue(null);
    vi.mocked(getRecordPendingApproval).mockResolvedValue({
      id: 'appr-1',
      context: { action_type: 'stage_transition' },
    } as any);

    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', {
      method: 'PATCH',
      body: { stage: 'qualified' },
    });
    const res = await PATCH(req, makeParams('rec-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('PENDING_APPROVAL');
  });

  it('updates record successfully', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const existingRecord = { id: 'rec-1', stage: 'lead', module_id: 'mod-1', org_id: VALID_ORG_ID, data: {} };
    const updatedRecord = { ...existingRecord, title: 'Updated' };
    let callCount = 0;
    const c: Record<string, any> = {};
    ['select', 'update', 'eq'].forEach(m => { c[m] = vi.fn(() => c); });
    c.single = vi.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: existingRecord, error: null });
      return Promise.resolve({ data: updatedRecord, error: null });
    });
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => c) });

    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', {
      method: 'PATCH',
      body: { title: 'Updated' },
    });
    const res = await PATCH(req, makeParams('rec-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated');
  });
});

describe('DELETE /api/crm/records/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('rec-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for agent role (only admin/manager can delete)', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_agent' }));
    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('rec-1'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when record not found', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const c = buildChainable({ data: null, error: null });
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => c) });

    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('rec-1'));
    expect(res.status).toBe(404);
  });

  it('returns 202 when deletion requires approval', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const record = { id: 'rec-1', title: 'Test', stage: 'lead', module_id: 'mod-1', org_id: VALID_ORG_ID, data: {} };
    const c = buildChainable({ data: record, error: null });
    mockCreateClient.mockResolvedValue({ from: vi.fn(() => c) });
    vi.mocked(checkApprovalRequired).mockResolvedValue({ processId: 'proc-1', ruleId: 'rule-1' } as any);
    vi.mocked(createApprovalRequest).mockResolvedValue({ success: true, approvalId: 'appr-1' } as any);

    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('rec-1'));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.requiresApproval).toBe(true);
  });

  it('deletes record successfully', async () => {
    mockGetAuthProfile.mockResolvedValue(mockProfile);
    const record = { id: 'rec-1', title: 'Test', stage: 'lead', module_id: 'mod-1', org_id: VALID_ORG_ID, data: {} };

    // Explicitly ensure approval mocks return null/false for this test
    vi.mocked(checkApprovalRequired).mockResolvedValue(null as any);
    vi.mocked(createApprovalRequest).mockResolvedValue({ success: false } as any);

    // Build chainable: select().eq().eq().single() then delete().eq().eq() → Promise
    let isDeletePath = false;
    let deleteEqStep = 0;
    const c: Record<string, any> = {};
    c.select = vi.fn(() => c);
    c.eq = vi.fn(() => {
      if (isDeletePath) {
        deleteEqStep++;
        // PostgREST: delete().eq('id').eq('org_id') — second eq completes the request
        if (deleteEqStep >= 2) {
          return Promise.resolve({ error: null });
        }
        return c;
      }
      return c;
    });
    c.delete = vi.fn(() => {
      isDeletePath = true;
      deleteEqStep = 0;
      return c;
    });
    c.single = vi.fn(() => Promise.resolve({ data: record, error: null }));

    mockCreateClient.mockResolvedValue({ from: vi.fn(() => c) });

    const req = buildRequest('http://localhost:3000/api/crm/records/rec-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('rec-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
