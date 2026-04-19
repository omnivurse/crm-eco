-- PR 16 — Kanban pipeline polish.
--
-- Adds an optional per-stage WIP (Work-In-Progress) limit so the kanban can
-- surface "too many deals in negotiation" style warnings. NULL = no limit.
-- Additive only; existing queries and seeds are unaffected.

ALTER TABLE public.crm_deal_stages
  ADD COLUMN IF NOT EXISTS wip_limit integer NULL
  CHECK (wip_limit IS NULL OR wip_limit >= 0);

COMMENT ON COLUMN public.crm_deal_stages.wip_limit IS
  'Optional per-stage WIP cap. The UI surfaces a warning when the column has more active deals than this value. NULL disables the cap.';
