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
        threadedConversationIds: [dawnId, frankId],
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

  it('does not merge a top-level email into the sender’s unrelated prior thread', () => {
    expect(
      pickSenderOwnedConversation({
        fromEmail: 'claims@provider.example',
        mailboxAddress: 'advocacy@payitforwardhealth.com',
        // No In-Reply-To/References match means this is a new conversation,
        // even though this shared provider address has written before.
        threadedConversationIds: [],
        candidates: [
          {
            id: 'prior-member-thread',
            contact_email: 'claims@provider.example',
            mailbox_address: 'advocacy@payitforwardhealth.com',
            last_message_at: '2026-09-03T15:49:59.000Z',
          },
        ],
        inboundByConversation: {
          'prior-member-thread': ['claims@provider.example'],
        },
      }),
    ).toBeNull();
  });

  it('ignores sender-owned conversations not referenced by the current headers', () => {
    expect(
      pickSenderOwnedConversation({
        fromEmail: 'frank.burnham@bankofcolorado.com',
        mailboxAddress: 'wendy@payitforwardhealth.com',
        threadedConversationIds: ['dawn-thread'],
        candidates: [
          {
            id: 'dawn-thread',
            contact_email: 'dawn.marsh@bankofcolorado.com',
            mailbox_address: 'wendy@payitforwardhealth.com',
          },
          {
            id: 'unrelated-frank-thread',
            contact_email: 'frank.burnham@bankofcolorado.com',
            mailbox_address: 'wendy@payitforwardhealth.com',
          },
        ],
        inboundByConversation: {
          'dawn-thread': ['dawn.marsh@bankofcolorado.com'],
          'unrelated-frank-thread': ['frank.burnham@bankofcolorado.com'],
        },
      }),
    ).toBeNull();
  });
});
