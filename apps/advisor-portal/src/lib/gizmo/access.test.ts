import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canUseAdvisorGizmo } from './access';

describe('canUseAdvisorGizmo', () => {
  it('denies missing roles and explicitly deactivated profiles', () => {
    assert.equal(canUseAdvisorGizmo(null), false);
    assert.equal(canUseAdvisorGizmo({ advisor_role: null, is_active: true }), false);
    assert.equal(canUseAdvisorGizmo({ advisor_role: '  ', is_active: true }), false);
    assert.equal(
      canUseAdvisorGizmo({ advisor_role: 'advisor', is_active: false }),
      false,
    );
  });

  it('allows active and legacy-null active advisor profiles', () => {
    assert.equal(
      canUseAdvisorGizmo({ advisor_role: 'advisor', is_active: true }),
      true,
    );
    assert.equal(
      canUseAdvisorGizmo({ advisor_role: 'advisor', is_active: null }),
      true,
    );
  });
});
