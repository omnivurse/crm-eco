import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { ensureCrmMemberRecordFromLead } from './lead-conversion-sync';

const SOURCE_RECORD_ID = '10000000-0000-4000-8000-000000000001';
const ENROLLMENT_MEMBER_ID = '20000000-0000-4000-8000-000000000002';
const CRM_MEMBER_RECORD_ID = '30000000-0000-4000-8000-000000000003';
const ORG_ID = '40000000-0000-4000-8000-000000000004';
const USER_ID = '50000000-0000-4000-8000-000000000005';

function queryBuilder<T>(terminal: 'single' | 'maybeSingle', result: T) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    [terminal]: vi.fn(async () => ({ data: result, error: null })),
  };
  return builder;
}

function createConversionClient(moduleKey: string) {
  const recordInsert = vi.fn();
  const linkInsert = vi.fn(async () => ({ data: null, error: null }));
  let recordQueryNumber = 0;

  const from = vi.fn((table: string) => {
    if (table === 'crm_modules') {
      return queryBuilder('maybeSingle', { id: 'members-module-id' });
    }

    if (table === 'crm_record_links') {
      return { insert: linkInsert };
    }

    if (table !== 'crm_records') {
      throw new Error(`Unexpected table: ${table}`);
    }

    recordQueryNumber += 1;
    if (recordQueryNumber === 1) {
      return queryBuilder('single', {
        id: SOURCE_RECORD_ID,
        title: 'Test Person',
        email: 'test@example.com',
        phone: '555-0100',
        status: 'Active',
        owner_id: USER_ID,
        data: { first_name: 'Test', lead_status: 'Qualified' },
        module: { key: moduleKey },
      });
    }
    if (recordQueryNumber === 2) {
      return queryBuilder('maybeSingle', null);
    }
    if (recordQueryNumber === 3) {
      const builder = {
        insert: vi.fn((payload: Record<string, unknown>) => {
          recordInsert(payload);
          return builder;
        }),
        select: vi.fn(() => builder),
        single: vi.fn(async () => ({
          data: { id: CRM_MEMBER_RECORD_ID },
          error: null,
        })),
      };
      return builder;
    }

    throw new Error('Unexpected crm_records query');
  });

  return {
    client: { from } as unknown as SupabaseClient,
    recordInsert,
    linkInsert,
  };
}

const params = {
  orgId: ORG_ID,
  leadRecordId: SOURCE_RECORD_ID,
  enrollmentMemberId: ENROLLMENT_MEMBER_ID,
  userId: USER_ID,
};

describe('ensureCrmMemberRecordFromLead', () => {
  it('creates the CRM member record when the conversion source is a Contact', async () => {
    const { client, recordInsert, linkInsert } = createConversionClient('contacts');

    const result = await ensureCrmMemberRecordFromLead(client, params);

    expect(result).toEqual({ ok: true, crmMemberRecordId: CRM_MEMBER_RECORD_ID });
    expect(recordInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG_ID,
        data: expect.objectContaining({
          linked_member_id: ENROLLMENT_MEMBER_ID,
          converted_from_contact_id: SOURCE_RECORD_ID,
        }),
      }),
    );
    expect(recordInsert.mock.calls[0]?.[0].data).not.toHaveProperty('converted_from_lead_id');
    expect(linkInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_record_id: SOURCE_RECORD_ID,
        target_record_id: CRM_MEMBER_RECORD_ID,
        link_type: 'contact_to_member',
      }),
    );
  });

  it('preserves Lead conversion lineage', async () => {
    const { client, recordInsert, linkInsert } = createConversionClient('leads');

    const result = await ensureCrmMemberRecordFromLead(client, params);

    expect(result.ok).toBe(true);
    expect(recordInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          converted_from_lead_id: SOURCE_RECORD_ID,
        }),
      }),
    );
    expect(linkInsert).toHaveBeenCalledWith(
      expect.objectContaining({ link_type: 'lead_to_member' }),
    );
  });

  it('rejects unrelated CRM modules', async () => {
    const { client, recordInsert, linkInsert } = createConversionClient('accounts');

    const result = await ensureCrmMemberRecordFromLead(client, params);

    expect(result).toEqual({ ok: false, error: 'Record is not a lead or contact' });
    expect(recordInsert).not.toHaveBeenCalled();
    expect(linkInsert).not.toHaveBeenCalled();
  });
});
