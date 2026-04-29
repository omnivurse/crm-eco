-- =============================================================================
-- Clear stale `data.lead_status` on contact records.
--
-- Companion to the precedence fix in
-- `apps/crm/src/lib/crm/merge-crm-data-json-to-row.ts`. Records like Barry
-- Donath were created directly as contacts but their JSONB still carries a
-- `lead_status: "Converted"` (origin: a default form value, or carried over
-- from the cross-module dedup). The TS fix prevents that stale value from
-- overriding `contact_status` on future saves, but the residue still
-- displays in any UI surface that reads `data.lead_status` directly.
--
-- This migration nulls `data.lead_status` on every contacts-module record
-- where:
--   • the record's `status` column is NOT 'Converted' (i.e. it was never
--     actually converted from a lead)
--   • AND `data.lead_status` is currently 'Converted'
--
-- Records that *were* legitimately converted (status = 'Converted' or
-- data.is_converted = 'true') keep their lead_status as historical data.
-- =============================================================================

UPDATE public.crm_records r
   SET data = data - 'lead_status',
       updated_at = now()
  FROM public.crm_modules m
 WHERE m.id = r.module_id
   AND m.key = 'contacts'
   AND r.data->>'lead_status' = 'Converted'
   AND COALESCE(r.status, '') <> 'Converted'
   AND COALESCE(r.data->>'is_converted', 'false') <> 'true';
