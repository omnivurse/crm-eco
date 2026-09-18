import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest, buildSupabaseClient } from '@/test/helpers';

const mocks = vi.hoisted(() => ({
  requireCrmApiKey: vi.fn(),
  emitMembershipWebhook: vi.fn(),
}));

vi.mock('@/lib/public-api-auth', () => ({
  requireCrmApiKey: mocks.requireCrmApiKey,
}));

vi.mock('@/lib/membership-webhooks', () => ({
  emitMembershipWebhook: mocks.emitMembershipWebhook,
}));

import { POST } from './route';

describe('POST /api/public/v1/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emitMembershipWebhook.mockResolvedValue({
      planned: 1,
      delivered: 1,
      dryRun: false,
    });
  });

  it('does not emit invoice.paid for an unpaid invoice', async () => {
    const built = buildSupabaseClient({
      invoices: {
        data: { id: 'invoice-1', status: 'sent', organization_id: 'org-a' },
        error: null,
      },
    });
    mocks.requireCrmApiKey.mockResolvedValue({
      key: { organization_id: 'org-a' },
      supabase: built.client,
      scopes: ['crm.write'],
    });

    const response = await POST(
      buildRequest('https://crm.example.test/api/public/v1/invoices', {
        method: 'POST',
        body: { event: 'invoice.paid', invoice_id: 'invoice-1' },
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.emitMembershipWebhook).not.toHaveBeenCalled();
  });

  it('emits invoice.paid only after the tenant invoice is paid', async () => {
    const built = buildSupabaseClient({
      invoices: {
        data: { id: 'invoice-1', status: 'paid', organization_id: 'org-a' },
        error: null,
      },
    });
    mocks.requireCrmApiKey.mockResolvedValue({
      key: { organization_id: 'org-a' },
      supabase: built.client,
      scopes: ['crm.write'],
    });

    const response = await POST(
      buildRequest('https://crm.example.test/api/public/v1/invoices', {
        method: 'POST',
        body: { event: 'invoice.paid', invoice_id: 'invoice-1' },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.emitMembershipWebhook).toHaveBeenCalledWith(
      built.client,
      'org-a',
      'invoice.paid',
      { invoice_id: 'invoice-1', status: 'paid' },
    );
  });
});
