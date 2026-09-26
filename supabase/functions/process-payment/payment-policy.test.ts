import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canProcessRefund } from './payment-policy.ts';

describe('canProcessRefund', () => {
  it('denies members, staff, and inactive financial admins', () => {
    assert.equal(canProcessRefund({ role: 'member', is_active: true }), false);
    assert.equal(canProcessRefund({ role: 'staff', is_active: true }), false);
    assert.equal(canProcessRefund({ role: 'admin', is_active: false }), false);
  });

  it('allows active financial roles and legacy null activity state', () => {
    assert.equal(canProcessRefund({ role: 'owner', is_active: true }), true);
    assert.equal(canProcessRefund({ role: 'super_admin', is_active: true }), true);
    assert.equal(canProcessRefund({ role: 'admin', is_active: null }), true);
  });
});
