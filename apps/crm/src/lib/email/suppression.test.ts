import { describe, expect, it } from 'vitest';
import { filterUnsubscribed } from './suppression';

describe('suppression', () => {
  it('splits unsubscribed recipients from the send set', async () => {
    const { allowed, suppressed } = await filterUnsubscribed(
      [{ email: 'a@x.com' }, { email: 'b@x.com' }],
      async (email) => email === 'b@x.com',
    );
    expect(allowed.map((r) => r.email)).toEqual(['a@x.com']);
    expect(suppressed.map((r) => r.email)).toEqual(['b@x.com']);
  });
});
