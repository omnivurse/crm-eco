import { describe, expect, it } from 'vitest';
import {
  pickSenderOwnedConversation,
  shouldJoinThreadedConversation,
} from '../../../../../supabase/functions/_shared/inbox-threading';

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

describe('pickSenderOwnedConversation', () => {
  it('after rejecting Dawn\'s thread, joins Frank\'s existing row', () => {
    const dawnId = 'dawn-thread';
    const frankId = 'frank-thread';
    expect(
      shouldJoinThreadedConversation({
        fromEmail: 'frank.burnham@bankofcolorado.com',
        conversationContactEmail: 'dawn.marsh@bankofcolorado.com',
        priorInboundFrom: ['dawn.marsh@bankofcolorado.com'],
      }),
    ).toBe(false);

    expect(
      pickSenderOwnedConversation({
        fromEmail: 'frank.burnham@bankofcolorado.com',
        mailboxAddress: 'wendy@payitforwardhealth.com',
        candidates: [
          {
            id: dawnId,
            contact_email: 'dawn.marsh@bankofcolorado.com',
            mailbox_address: 'wendy@payitforwardhealth.com',
            last_message_at: '2026-09-02T18:50:46.000Z',
          },
          {
            id: frankId,
            contact_email: 'frank.burnham@bankofcolorado.com',
            mailbox_address: 'wendy@payitforwardhealth.com',
            last_message_at: '2026-09-03T15:49:59.000Z',
          },
        ],
        inboundByConversation: {
          [dawnId]: ['dawn.marsh@bankofcolorado.com'],
          [frankId]: ['frank.burnham@bankofcolorado.com'],
        },
      }),
    ).toBe(frankId);
  });
});
