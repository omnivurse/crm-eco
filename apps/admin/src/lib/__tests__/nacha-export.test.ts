import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { generateNachaFile, type AchOriginatorConfig } from '@crm-eco/lib/billing';
import {
  NachaTransactionClaimError,
  persistNachaExport,
  type PendingAchTransaction,
} from '../nacha-export';

const TRANSACTION_ID = '11111111-1111-1111-1111-111111111111';

function originator(): AchOriginatorConfig {
  return {
    destinationRouting: '021000021',
    destinationName: 'TEST DEST BANK',
    companyName: 'TEST ORIGINATOR',
    companyId: '1234567890',
    odfiId: '02100002',
    secCode: 'PPD',
    fileNamePattern: 'NACHA_yyyyMMdd_HHmmss.txt',
    settlementRouting: '021000021',
    settlementAccount: '555667788',
    settlementAccountType: 'checking',
  };
}

function transaction(): PendingAchTransaction {
  return {
    id: TRANSACTION_ID,
    member_id: '22222222-2222-2222-2222-222222222222',
    amount: 10,
    transaction_type: 'charge',
    status: 'pending',
    payment_profile_id: '33333333-3333-3333-3333-333333333333',
    account_last4: '6789',
    account_type: 'checking',
    member_first_name: 'Jane',
    member_last_name: 'Doe',
    member_email: 'jane@example.test',
  };
}

describe('persistNachaExport', () => {
  it('fails before writing trace rows when another export already claimed the transaction', async () => {
    const touchedTables: string[] = [];
    const supabase = {
      from(table: string) {
        touchedTables.push(table);
        if (table === 'nacha_files') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'file-1' }, error: null }),
              }),
            }),
            update: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          };
        }
        if (table === 'billing_transactions') {
          const query = {
            update: () => query,
            in: () => query,
            eq: () => query,
            select: async () => ({ data: [], error: null }),
          };
          return query;
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;

    const config = originator();
    const txn = transaction();
    const file = generateNachaFile({
      originator: config,
      entries: [
        {
          transactionId: txn.id,
          transactionType: 'charge',
          amountCents: 1000,
          routingNumber: '021000021',
          accountNumber: '123456789',
          accountType: 'checking',
          individualName: 'Jane Doe',
          individualId: txn.member_id,
        },
      ],
      effectiveDate: '2026-09-22',
      fileIdModifier: 'A',
    });

    await expect(
      persistNachaExport({
        supabase,
        organizationId: '44444444-4444-4444-4444-444444444444',
        profileId: '55555555-5555-5555-5555-555555555555',
        originator: config,
        effectiveDate: '2026-09-22',
        txns: [txn],
        file,
      }),
    ).rejects.toBeInstanceOf(NachaTransactionClaimError);

    expect(touchedTables).not.toContain('nacha_file_transactions');
  });
});
