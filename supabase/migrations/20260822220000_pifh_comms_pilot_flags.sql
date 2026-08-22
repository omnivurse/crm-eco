-- =============================================================================
-- PIFH: enable the comms outbox / inbound-ledger pilot for one tenant
-- =============================================================================
--
-- Global crm.comms.* rows stay OFF. This adds org-scoped rows for PIFH only
-- so persist-before-send (outbox_send) and exactly-once inbound (closed_loop)
-- turn on without flipping every tenant.
--
-- Already applied live 2026-08-22. Re-runs are no-ops via
-- uq_crm_feature_flags_org_key. Does not enable kill_switch or mailbox_oauth.
--
-- ROLLBACK:
--   UPDATE public.crm_feature_flags
--      SET enabled = false, rollout_percentage = 0, updated_at = now()
--    WHERE organization_id = '00000000-0000-0000-0000-000000000001'
--      AND flag_key IN (
--        'crm.comms.outbox_send',
--        'crm.comms.closed_loop',
--        'crm.comms.foundation'
--      );
-- =============================================================================

SET lock_timeout = '5s';

INSERT INTO public.crm_feature_flags (
  organization_id,
  flag_key,
  enabled,
  rollout_percentage,
  description
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'crm.comms.outbox_send',
    true,
    100,
    'PIFH pilot: persist-before-send outbox'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'crm.comms.closed_loop',
    true,
    100,
    'PIFH pilot: inbound ledger'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'crm.comms.foundation',
    true,
    100,
    'PIFH pilot: comms foundation'
  )
ON CONFLICT (organization_id, flag_key) WHERE (organization_id IS NOT NULL)
DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percentage = EXCLUDED.rollout_percentage,
  description = EXCLUDED.description,
  updated_at = now();
