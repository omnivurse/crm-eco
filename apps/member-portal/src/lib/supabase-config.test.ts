import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { missingSupabaseConfigRedirect } from './supabase-config';

describe('missingSupabaseConfigRedirect', () => {
  it('fails closed for enrollment Server Components when Supabase is unavailable', () => {
    assert.equal(missingSupabaseConfigRedirect('/enroll'), '/access-denied?reason=config');
    assert.equal(
      missingSupabaseConfigRedirect('/enroll/community-plan'),
      '/access-denied?reason=config',
    );
  });

  it('leaves public auth and API routes to their existing config handling', () => {
    assert.equal(missingSupabaseConfigRedirect('/signin'), null);
    assert.equal(missingSupabaseConfigRedirect('/api/enroll/public'), null);
    assert.equal(missingSupabaseConfigRedirect('/enrollment'), null);
    assert.equal(missingSupabaseConfigRedirect('/enrollments/member-1'), null);
  });
});
