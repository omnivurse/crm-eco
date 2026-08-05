-- ============================================================================
-- Surface in-app instructions on the County address field so reps know to
-- capture it for Colorado exchange (Connect for Health) plan tracking.
-- Idempotent: only fills tooltip when null/blank; does not overwrite custom text.
-- ============================================================================

UPDATE public.crm_fields f
SET
  tooltip = 'Needed for Colorado exchange (Connect for Health) plan tracking. Enter the county name (e.g. Denver, Jefferson, El Paso).',
  updated_at = now()
FROM public.crm_modules m
WHERE f.module_id = m.id
  AND m.key IN ('contacts', 'leads', 'members')
  AND f.key = 'county'
  AND (f.tooltip IS NULL OR btrim(f.tooltip) = '');
