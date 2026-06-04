-- C2 historical-dup MERGE: consolidate the 64 same-name true-duplicate member groups
-- (~69 excess rows) onto a keeper per group, then SOFT-MERGE the duplicates.
-- Keeper per (organization_id, lower(email), lower(first_name), lower(last_name)) group =
-- the member with the most enrollments, tie-break oldest created_at, then lowest id.
-- Family members sharing an email are EXCLUDED (the grouping key includes first+last name).
-- Soft-merge (reversible-ish, preserves PHI row + audit): set merged_into_id=keeper,
-- status='inactive', and mangle email to a unique sentinel so the dup no longer collides
-- on the (org,email,first,last) uniqueness we want to enforce. All 30 inbound FKs are
-- repointed to the keeper first; two child tables with member_id uniques are de-conflicted.


CREATE TEMP TABLE _member_merge_map ON COMMIT DROP AS
WITH grp AS (
  SELECT organization_id, lower(email) le, lower(btrim(first_name)) fn, lower(btrim(last_name)) ln
  FROM public.members WHERE email IS NOT NULL AND btrim(email) <> ''
  GROUP BY 1,2,3,4 HAVING count(*) > 1
),
ranked AS (
  SELECT m.id, m.organization_id,
         lower(m.email) le, lower(btrim(m.first_name)) fn, lower(btrim(m.last_name)) ln,
         row_number() OVER (
           PARTITION BY m.organization_id, lower(m.email), lower(btrim(m.first_name)), lower(btrim(m.last_name))
           ORDER BY (SELECT count(*) FROM public.enrollments e WHERE e.primary_member_id = m.id) DESC,
                    m.created_at ASC NULLS LAST, m.id ASC
         ) AS rn
  FROM public.members m
  JOIN grp g ON g.organization_id=m.organization_id AND g.le=lower(m.email)
            AND g.fn=lower(btrim(m.first_name)) AND g.ln=lower(btrim(m.last_name))
)
SELECT d.id AS dup_id, k.id AS keeper_id
FROM ranked d
JOIN ranked k ON k.organization_id=d.organization_id AND k.le=d.le AND k.fn=d.fn AND k.ln=d.ln AND k.rn=1
WHERE d.rn > 1;

-- De-conflict the two member_id uniques BEFORE repointing:
-- invoice_group_members(invoice_group_id, member_id): drop dup rows that would collide with keeper.
DELETE FROM public.invoice_group_members ig USING _member_merge_map mm
 WHERE ig.member_id = mm.dup_id
   AND EXISTS (SELECT 1 FROM public.invoice_group_members k
               WHERE k.invoice_group_id = ig.invoice_group_id AND k.member_id = mm.keeper_id);
-- payment_profiles default-active partial unique: unset dup's default if keeper already has one.
UPDATE public.payment_profiles p SET is_default = false
 FROM _member_merge_map mm
 WHERE p.member_id = mm.dup_id AND p.is_default = true AND p.is_active = true
   AND EXISTS (SELECT 1 FROM public.payment_profiles k
               WHERE k.member_id = mm.keeper_id AND k.is_default = true AND k.is_active = true);

-- Repoint all inbound FK references from duplicates to the keeper.
UPDATE public.activities c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.age_up_out_results c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.billing_audit_log c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.billing_failures c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.billing_schedules c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.billing_transactions c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.commission_transactions c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.commissions c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.dependents c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.enrollment_contracts c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.enrollment_link_conversions c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.enrollment_logs c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.enrollment_wizard_state c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.enrollments c SET primary_member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.primary_member_id = mm.dup_id;
UPDATE public.invoice_group_members c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.invoices c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.member_change_requests c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.member_documents c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.member_notifications c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.members c SET merged_into_id = mm.keeper_id FROM _member_merge_map mm WHERE c.merged_into_id = mm.dup_id;
UPDATE public.memberships c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.needs c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.notification_preferences c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.notification_queue c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.payment_profiles c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.payment_transactions c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.profiles c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.promo_code_uses c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.sent_emails c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;
UPDATE public.tickets c SET member_id = mm.keeper_id FROM _member_merge_map mm WHERE c.member_id = mm.dup_id;

-- Soft-merge the duplicates: link to keeper + mark inactive. Email is PRESERVED (no
-- mangling) for PHI/audit; the unique index below excludes merged rows via
-- merged_into_id IS NULL, so they don't need to be made artificially unique.
UPDATE public.members m
   SET merged_into_id = mm.keeper_id,
       status = 'inactive',
       updated_at = now()
 FROM _member_merge_map mm WHERE m.id = mm.dup_id;

-- Hard guarantee against future true-duplicates: one ACTIVE member per
-- (organization, email, first name, last name). Merged dups excluded
-- (merged_into_id IS NULL), as are members without an email. Case-insensitive.
-- Does NOT block family members sharing an email (different names -> different key).
CREATE UNIQUE INDEX IF NOT EXISTS members_org_email_name_active_uniq
  ON public.members (organization_id, lower(email), lower(btrim(first_name)), lower(btrim(last_name)))
  WHERE merged_into_id IS NULL AND email IS NOT NULL AND btrim(email) <> '';
