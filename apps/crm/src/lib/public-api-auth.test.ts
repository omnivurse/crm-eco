import { describe, expect, it } from 'vitest';
import { hasCrmApiScope } from './public-api-scopes';

describe('hasCrmApiScope', () => {
  it('allows existing CRM read keys to call membership reads', () => {
    expect(hasCrmApiScope(['crm.read'], 'read')).toBe(true);
    expect(hasCrmApiScope(['crm.read'], 'write')).toBe(false);
  });

  it('allows crm.write and crm.admin to write', () => {
    expect(hasCrmApiScope(['crm.write'], 'write')).toBe(true);
    expect(hasCrmApiScope(['crm.admin'], 'write')).toBe(true);
  });
});
