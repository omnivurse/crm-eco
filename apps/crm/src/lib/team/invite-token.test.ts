import { describe, expect, it } from 'vitest';
import { buildInviteAcceptPath, readInviteToken } from './invite-token';

describe('readInviteToken', () => {
  it('prefers the query parameter so email clients keep the token', () => {
    expect(readInviteToken('?token=abc123', '#token=old')).toBe('abc123');
    expect(readInviteToken('token=abc123', '')).toBe('abc123');
  });

  it('still reads the legacy hash used in already-sent mail', () => {
    expect(readInviteToken('', '#token=legacy-token')).toBe('legacy-token');
    expect(readInviteToken('', 'token=legacy-token')).toBe('legacy-token');
  });

  it('returns null when neither query nor hash has a token', () => {
    expect(readInviteToken('', '')).toBeNull();
    expect(readInviteToken('?foo=1', '#other=x')).toBeNull();
    expect(readInviteToken('', '#token=')).toBeNull();
  });
});

describe('buildInviteAcceptPath', () => {
  it('puts the token in the query string', () => {
    expect(buildInviteAcceptPath('a+b')).toBe('/accept-invite?token=a%2Bb');
  });
});
