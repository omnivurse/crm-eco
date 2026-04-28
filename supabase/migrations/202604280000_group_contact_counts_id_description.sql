-- Align group_contact_counts with CRM UI + types: expose primary key as `id`,
-- keep `group_id` as a duplicate for backward compatibility (FK metadata / clients),
-- and surface `description` from crm_contact_groups.

DROP VIEW IF EXISTS public.group_contact_counts;
CREATE VIEW public.group_contact_counts WITH (security_invoker = on) AS
SELECT
  g.id,
  g.id AS group_id,
  g.organization_id,
  g.group_name,
  g.group_type,
  g.description,
  g.color,
  g.icon,
  g.is_system,
  g.is_active,
  g.display_order,
  count(gm.id) AS member_count
FROM public.crm_contact_groups g
LEFT JOIN public.crm_contact_group_members gm ON gm.group_id = g.id
GROUP BY
  g.id,
  g.organization_id,
  g.group_name,
  g.group_type,
  g.description,
  g.color,
  g.icon,
  g.is_system,
  g.is_active,
  g.display_order;

COMMENT ON VIEW public.group_contact_counts IS 'Contact groups with member counts (id + description + counts)';

NOTIFY pgrst, 'reload schema';
