-- Ensure lead conversion RPCs are executable by CRM staff (authenticated) and server routes (service_role).
-- Fixes "permission denied for function convert_lead_to_contact" when API uses session JWT
-- or when CREATE OR REPLACE dropped inherited grants on a signature.

SET lock_timeout = '5s';

GRANT EXECUTE ON FUNCTION public.convert_lead_to_contact(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.repair_converted_contact_insurance_data(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Rollback:
-- REVOKE EXECUTE ON FUNCTION public.convert_lead_to_contact(uuid, uuid, uuid) FROM authenticated, service_role;
-- (re-run phase5 keep-list grants instead of leaving revoked)
