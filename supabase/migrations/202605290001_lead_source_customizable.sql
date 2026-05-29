-- Mark lead_source as non-system field so admins can customize its options
-- via Settings → Fields. The lead_source field doesn't need system-level
-- protection (unlike first_name, last_name, email which are structural).

UPDATE crm_fields
SET is_system = false
WHERE key = 'lead_source';
