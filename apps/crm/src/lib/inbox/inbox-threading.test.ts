import { describe, expect, it } from 'vitest';
import { shouldJoinThreadedConversation } from '../../../../../supabase/functions/_shared/inbox-threading';

describe('shouldJoinThreadedConversation', () => {
  it('joins when the sender already owns the thread', () => {
    expect(
      shouldJoinThreadedConversation({
        fromEmail: 'dawn.marsh@bankofcolorado.com',
        conversationContactEmail: 'dawn.marsh@bankofcolorado.com',
        priorInboundFrom: ['dawn.marsh@bankofcolorado.com'],
      }),
    ).toBe(true);
  });

  it('starts a new conversation when a different person hits Reply-All', () => {
    expect(
      shouldJoinThreadedConversation({
        fromEmail: 'frank.burnham@bankofcolorado.com',
        conversationContactEmail: 'dawn.marsh@bankofcolorado.com',
        priorInboundFrom: ['dawn.marsh@bankofcolorado.com'],
      }),
    ).toBe(false);
  });

  it('joins a later reply from the same new person on their own thread', () => {
    expect(
      shouldJoinThreadedConversation({
        fromEmail: 'Frank.Burnham@bankofcolorado.com',
        conversationContactEmail: 'frank.burnham@bankofcolorado.com',
        priorInboundFrom: ['frank.burnham@bankofcolorado.com'],
      }),
    ).toBe(true);
  });

  it('refuses to join when the candidate thread has no known counterpart', () => {
    expect(
      shouldJoinThreadedConversation({
        fromEmail: 'someone@example.com',
        conversationContactEmail: null,
        priorInboundFrom: [],
      }),
    ).toBe(false);
  });
});
