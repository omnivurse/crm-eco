import { describe, expect, it } from 'vitest';
import { canDeleteEmailAssets, canUploadEmailAssets } from './asset-permissions';

describe('email asset permissions', () => {
  it('lets admins and managers upload and delete', () => {
    for (const role of ['crm_admin', 'crm_manager']) {
      expect(canUploadEmailAssets(role)).toBe(true);
      expect(canDeleteEmailAssets(role)).toBe(true);
    }
  });

  it('lets agents upload but not delete', () => {
    expect(canUploadEmailAssets('crm_agent')).toBe(true);
    expect(canDeleteEmailAssets('crm_agent')).toBe(false);
  });

  it('refuses a member with no crm_role', () => {
    // The state a real production account is in: profiles.crm_role is null,
    // so the page must show a view-only affordance rather than a button that
    // 403s on click.
    for (const role of [null, undefined, '']) {
      expect(canUploadEmailAssets(role)).toBe(false);
      expect(canDeleteEmailAssets(role)).toBe(false);
    }
  });

  it('refuses unknown roles rather than defaulting open', () => {
    expect(canUploadEmailAssets('viewer')).toBe(false);
    expect(canDeleteEmailAssets('crm_ADMIN')).toBe(false);
  });
});
