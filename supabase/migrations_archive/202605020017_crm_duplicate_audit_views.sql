-- =============================================================================
-- Read-only audit views of duplicate clusters in crm_records, all orgs.
--
-- Builds on the prior PIFH-only sweeps (..0011 → ..0014) which together
-- merged ~1010 cross-module duplicates under conservative rules. This pass
-- extends visibility to EVERY org in the database under the same rules,
-- so the operator can see what's left before authorizing another merge run.
--
-- This migration mutates NOTHING. It creates two views:
--
--   crm_duplicate_audit         — one row per duplicate cluster, with
--                                 keeper_id_oldest, dup ids, member titles,
--                                 module ids, and (for phone+name clusters)
--                                 the minimum pairwise title trigram score
--                                 so the operator can re-apply the prior
--                                 ≥0.5 threshold per-cluster.
--
--   crm_duplicate_audit_summary — per-org / per-rule rollup with cluster
--                                 counts and "mergeable_records" totals,
--                                 both raw and after the ≥0.5 trigram
--                                 threshold for phone+name clusters.
--
-- Rules (matching prior sweeps):
--   email      : same-org records sharing lower(btrim(email)).
--                Cross- AND same-module are both surfaced.
--   phone+name : same-org records sharing 10+ digits of phone, with
--                min_name_similarity exposed for operator-side filtering.
--                A phone cluster fully subsumed by an email cluster is
--                suppressed to avoid double-counting the same group.
--
-- Both views are security_invoker so existing RLS on crm_records / orgs
-- continues to apply — admins see only orgs they belong to.
-- =============================================================================

BEGIN;

DROP VIEW IF EXISTS public.crm_duplicate_audit_summary;
DROP VIEW IF EXISTS public.crm_duplicate_audit;

CREATE VIEW public.crm_duplicate_audit
  WITH (security_invoker = true)
AS
WITH
email_clusters AS (
  SELECT
    r.org_id,
    'email'::text                               AS rule,
    lower(btrim(r.email))                       AS match_key,
    array_agg(r.id          ORDER BY r.created_at, r.id) AS ids,
    array_agg(r.title       ORDER BY r.created_at, r.id) AS titles,
    array_agg(r.module_id   ORDER BY r.created_at, r.id) AS module_ids,
    count(*)::int                               AS member_count,
    NULL::numeric                               AS min_name_similarity
  FROM public.crm_records r
  WHERE r.email IS NOT NULL
    AND btrim(r.email) <> ''
  GROUP BY r.org_id, lower(btrim(r.email))
  HAVING count(*) > 1
),
phone_clusters_raw AS (
  SELECT
    r.org_id,
    regexp_replace(coalesce(r.phone, ''), '\D', '', 'g') AS digits,
    array_agg(r.id        ORDER BY r.created_at, r.id) AS ids,
    array_agg(r.title     ORDER BY r.created_at, r.id) AS titles,
    array_agg(r.module_id ORDER BY r.created_at, r.id) AS module_ids,
    count(*)::int                                       AS member_count
  FROM public.crm_records r
  WHERE length(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g')) >= 10
  GROUP BY r.org_id, regexp_replace(coalesce(r.phone, ''), '\D', '', 'g')
  HAVING count(*) > 1
),
phone_clusters AS (
  SELECT
    pc.org_id,
    'phone+name'::text AS rule,
    pc.digits          AS match_key,
    pc.ids,
    pc.titles,
    pc.module_ids,
    pc.member_count,
    -- min pairwise trigram similarity across the cluster's titles
    (
      SELECT min(similarity(coalesce(t1.t, ''), coalesce(t2.t, '')))
      FROM unnest(pc.titles) WITH ORDINALITY AS t1(t, i),
           unnest(pc.titles) WITH ORDINALITY AS t2(t, i)
      WHERE t1.i < t2.i
    )                  AS min_name_similarity
  FROM phone_clusters_raw pc
  WHERE NOT EXISTS (
    SELECT 1
    FROM email_clusters ec
    WHERE ec.org_id = pc.org_id
      AND ec.ids   @> pc.ids
  )
)
SELECT
  c.org_id,
  o.name               AS org_name,
  c.rule,
  c.match_key,
  c.ids[1]             AS keeper_id_oldest,
  c.ids[2:]            AS duplicate_ids,
  c.titles,
  c.module_ids,
  c.member_count,
  c.min_name_similarity
FROM (
  SELECT * FROM email_clusters
  UNION ALL
  SELECT * FROM phone_clusters
) c
LEFT JOIN public.organizations o ON o.id = c.org_id
ORDER BY c.member_count DESC, c.org_id, c.rule, c.match_key;

COMMENT ON VIEW public.crm_duplicate_audit IS
  'Read-only audit of duplicate clusters in crm_records under conservative rules (email, phone+name). All orgs. min_name_similarity is NULL for email clusters; for phone+name clusters, filter min_name_similarity >= 0.5 to match the prior PIFH sweep policy. See migration 202605020017.';

GRANT SELECT ON public.crm_duplicate_audit TO authenticated;


CREATE VIEW public.crm_duplicate_audit_summary
  WITH (security_invoker = true)
AS
SELECT
  org_id,
  org_name,
  rule,
  count(*)::int                              AS cluster_count,
  sum(member_count - 1)::int                 AS mergeable_records,
  sum(member_count)::int                     AS total_records_in_clusters,
  count(*) FILTER (
    WHERE rule = 'email'
       OR (rule = 'phone+name' AND coalesce(min_name_similarity, 0) >= 0.5)
  )::int                                     AS cluster_count_passing_threshold,
  sum(member_count - 1) FILTER (
    WHERE rule = 'email'
       OR (rule = 'phone+name' AND coalesce(min_name_similarity, 0) >= 0.5)
  )::int                                     AS mergeable_records_passing_threshold
FROM public.crm_duplicate_audit
GROUP BY org_id, org_name, rule
ORDER BY mergeable_records_passing_threshold DESC NULLS LAST, org_id, rule;

COMMENT ON VIEW public.crm_duplicate_audit_summary IS
  'Per-org / per-rule rollup of crm_duplicate_audit. mergeable_records_passing_threshold is the count of dup rows that would be merged if the prior PIFH policy (phone+name trigram >= 0.5) is applied org-wide. Run this first to see scope before authorizing a merge migration.';

GRANT SELECT ON public.crm_duplicate_audit_summary TO authenticated;

COMMIT;
