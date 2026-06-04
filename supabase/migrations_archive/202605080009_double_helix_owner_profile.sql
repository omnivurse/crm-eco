-- Grants the Double Helix Software founder/owner an active membership in the
-- internal Double Helix tenant org via organization_members. We use
-- organization_members rather than a second profile row because profiles has
-- a UNIQUE(user_id) constraint; the founder's primary profile already points
-- at PIFH. Membership lets the admin-app tenant switcher surface Double Helix
-- alongside their other orgs.
--
-- Looks the user up by email in auth.users and silently no-ops if the user
-- doesn't exist (e.g., they haven't signed up via Supabase Auth yet).

INSERT INTO organization_members (organization_id, user_id, role, is_active, is_default)
SELECT
  '00000000-d0d0-4000-8000-000000000001',
  u.id,
  'owner',
  true,
  false
FROM auth.users u
WHERE u.email = 'omnivurse@gmail.com'
ON CONFLICT (organization_id, user_id) DO NOTHING;
