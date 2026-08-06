import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  decideProfileAccess,
  membershipAllowsAccess,
} from './org-auth-policy.ts';

describe('decideProfileAccess', () => {
  it('denies a deactivated profile even when its home-org role matches', () => {
    assert.equal(
      decideProfileAccess(
        {
          organization_id: 'org-a',
          role: 'admin',
          is_active: false,
        },
        'org-a',
        ['admin'],
      ),
      'deny',
    );
  });

  it('allows legacy null activity state for a matching home-org role', () => {
    assert.equal(
      decideProfileAccess(
        {
          organization_id: 'org-a',
          role: 'admin',
          is_active: null,
        },
        'org-a',
        ['admin'],
      ),
      'allow',
    );
  });

  it('checks tenant membership when the target is not the profile home org', () => {
    assert.equal(
      decideProfileAccess(
        {
          organization_id: 'org-a',
          role: 'owner',
          is_active: true,
        },
        'org-b',
        ['owner', 'admin'],
      ),
      'check_membership',
    );
  });
});

describe('membershipAllowsAccess', () => {
  it('allows an explicitly active secondary-tenant membership with a permitted role', () => {
    assert.equal(
      membershipAllowsAccess(
        {
          role: 'admin',
          is_active: true,
        },
        ['owner', 'admin'],
      ),
      true,
    );
  });

  it('denies inactive memberships and disallowed roles', () => {
    assert.equal(
      membershipAllowsAccess({ role: 'admin', is_active: false }, ['owner', 'admin']),
      false,
    );
    assert.equal(
      membershipAllowsAccess({ role: 'staff', is_active: true }, ['owner', 'admin']),
      false,
    );
  });
});
