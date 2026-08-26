import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    __dirname,
    '../../../../../../../../supabase/migrations/20260826110756_scope_crm_user_roles_by_organization.sql',
  ),
  'utf8',
);

describe('tenant-scoped catalog role migration', () => {
  it('makes role assignment identity organization-aware', () => {
    expect(migration).toContain('ALTER COLUMN organization_id SET NOT NULL');
    expect(migration).toContain(
      'UNIQUE (organization_id, user_id, role_id)',
    );
  });

  it('requires assignment and permission checks to use the requested organization', () => {
    expect(migration).toContain('ur.organization_id = p_org_id');
    expect(migration).toContain('r.organization_id = p_org_id');
    expect(migration).toContain('om.organization_id = p_org_id');
    expect(migration).toContain('om.is_active = true');
  });

  it('allows global templates only through a tenant-scoped assignment policy', () => {
    expect(migration).toMatch(
      /CREATE POLICY crm_user_roles_admin__insert[\s\S]*r\.organization_id IS NULL[\s\S]*r\.organization_id = crm_user_roles\.organization_id/,
    );
  });
});
