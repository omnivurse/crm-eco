-- ============================================================================
-- CRM-ECO: Layout V2 Feature Flag Infrastructure
-- Additive migration only — introduces per-user UI preferences and a shared
-- feature-flags table so we can roll out the new CRM record layout safely.
-- Nothing existing is altered or dropped.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-user UI preferences (JSONB bag; theme already lives in its own col)
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ui_preferences jsonb
  NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.ui_preferences IS
  'Per-user UI preferences bag (e.g. { "crm_layout_v2": true }). Additive — safe for ad-hoc flags.';

CREATE INDEX IF NOT EXISTS idx_profiles_ui_preferences
  ON profiles USING gin (ui_preferences);

-- ---------------------------------------------------------------------------
-- 2. crm_feature_flags: org-level toggles with a safe, inspectable history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percentage smallint NOT NULL DEFAULT 0
    CHECK (rollout_percentage BETWEEN 0 AND 100),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique indexes so NULL organization_id (global default) also enforces uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_feature_flags_org_key
  ON crm_feature_flags (organization_id, flag_key)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_feature_flags_global_key
  ON crm_feature_flags (flag_key)
  WHERE organization_id IS NULL;

COMMENT ON TABLE crm_feature_flags IS
  'Org-scoped feature flags. organization_id NULL = global default. Per-user overrides live in profiles.ui_preferences.';

CREATE INDEX IF NOT EXISTS idx_crm_feature_flags_key
  ON crm_feature_flags (flag_key);
CREATE INDEX IF NOT EXISTS idx_crm_feature_flags_org_key
  ON crm_feature_flags (organization_id, flag_key);

-- RLS: everyone authenticated can read flags for their org; only admins can write.
ALTER TABLE crm_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_feature_flags_select ON crm_feature_flags;
CREATE POLICY crm_feature_flags_select
  ON crm_feature_flags
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS crm_feature_flags_admin_write ON crm_feature_flags;
CREATE POLICY crm_feature_flags_admin_write
  ON crm_feature_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND crm_role = 'crm_admin'
        AND (crm_feature_flags.organization_id IS NULL
             OR crm_feature_flags.organization_id = profiles.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND crm_role = 'crm_admin'
        AND (crm_feature_flags.organization_id IS NULL
             OR crm_feature_flags.organization_id = profiles.organization_id)
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION crm_feature_flags_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_feature_flags_touch ON crm_feature_flags;
CREATE TRIGGER trg_crm_feature_flags_touch
  BEFORE UPDATE ON crm_feature_flags
  FOR EACH ROW EXECUTE FUNCTION crm_feature_flags_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Seed the Layout V2 flag as a GLOBAL, default-OFF row so every org
--    inherits the safe default until an admin flips it.
-- ---------------------------------------------------------------------------
INSERT INTO crm_feature_flags (organization_id, flag_key, enabled, rollout_percentage, description)
SELECT NULL, 'crm.layout.v2', false, 0,
       'Zoho-style 3-column record detail layout. Users may opt in via profile preferences regardless of org setting.'
WHERE NOT EXISTS (
  SELECT 1 FROM crm_feature_flags
  WHERE organization_id IS NULL AND flag_key = 'crm.layout.v2'
);
