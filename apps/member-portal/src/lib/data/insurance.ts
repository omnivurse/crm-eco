import 'server-only';

import { cache } from 'react';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

/**
 * Health-INSURANCE details for a member (carrier / premium / deductible / plan
 * name). These live in `crm_records.data` (JSONB), which portal members are
 * deliberately RLS-blocked from reading. So this uses the SERVICE-ROLE client,
 * HARD-SCOPED to the member's OWN record via the globally-unique
 * `data->>'linked_member_id'` soft-link (a member UUID matches only that
 * member's record, so there is no cross-tenant read).
 *
 * Read-only, additive, reversible — no schema change, no writes. Returns `null`
 * when the member has no insurance data on their CRM record (nothing is ever
 * fabricated). Callers MUST pass the *authenticated* member's own id.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InsuranceDetails {
  carrier: string | null;
  premium: number | null;
  deductible: number | null;
  planName: string | null;
}

function jsonString(data: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  }
  return null;
}

function jsonNumber(data: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = data[key];
    if (v === null || v === undefined || v === '') continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export const getMemberInsuranceDetails = cache(
  async (memberId: string): Promise<InsuranceDetails | null> => {
    if (!memberId) return null;
    try {
      return await readInsuranceDetails(memberId);
    } catch (err) {
      // Never let a CRM/service-role read failure break the coverage page —
      // just fall back to no carrier (the card shows the market label).
      console.warn('[getMemberInsuranceDetails] read failed', err);
      return null;
    }
  },
);

async function readInsuranceDetails(memberId: string): Promise<InsuranceDetails | null> {
    const service = createServiceRoleClient();

    // The member's linked CRM record(s). `linked_member_id` is the member's own
    // UUID, so this filter alone cannot return another member's row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (service as any)
      .from('crm_records')
      .select('data, carrier_id, updated_at')
      .eq('data->>linked_member_id', memberId)
      .order('updated_at', { ascending: false })
      .limit(5);

    for (const row of (rows ?? []) as Array<{
      data: Record<string, unknown> | null;
      carrier_id: string | null;
    }>) {
      const data = row?.data ?? {};
      const carrierRaw = jsonString(data, 'health_insurance_carrier', 'insurance_carrier');
      const premium = jsonNumber(data, 'health_insurance_premium');
      const deductible = jsonNumber(data, 'health_insurance_deductible');
      const planName = jsonString(data, 'health_insurance_plan_name');

      // No insurance data on this record — keep scanning the member's records.
      if (!carrierRaw && premium === null && deductible === null && !planName) continue;

      let carrier = carrierRaw;
      // The carrier may be stored as an insurance_carriers UUID (indexed column
      // or the JSONB value) — resolve it to a readable name.
      const carrierId =
        carrierRaw && UUID_RE.test(carrierRaw) ? carrierRaw : row.carrier_id;
      if ((!carrier || UUID_RE.test(carrier)) && carrierId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: c } = await (service as any)
          .from('insurance_carriers')
          .select('carrier_name')
          .eq('id', carrierId)
          .maybeSingle();
        if (c?.carrier_name) carrier = c.carrier_name as string;
      }
      // Never surface a raw UUID.
      if (carrier && UUID_RE.test(carrier)) carrier = null;

      if (!carrier && premium === null && deductible === null && !planName) continue;
      return { carrier, premium, deductible, planName };
    }
    return null;
}
