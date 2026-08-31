import { describe, expect, it } from 'vitest';
import { participantsFromThread } from './thread-participants';

describe('participantsFromThread', () => {
  it('collects the conversation contact and every from/to/cc address', () => {
    const result = participantsFromThread({
      conversation: { contact_email: 'contact@example.com', contact_name: 'Casey Contact' },
      messages: [
        {
          direction: 'inbound',
          from_address: 'alice@example.com',
          from_name: 'Alice',
          to_address: 'bob@example.com',
          cc_addresses: [{ email: 'carol@example.com', name: 'Carol' }],
        },
      ],
      excludeEmails: [],
    });

    expect(result).toEqual([
      { email: 'contact@example.com', name: 'Casey Contact' },
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com' },
      { email: 'carol@example.com', name: 'Carol' },
    ]);
  });

  it('puts the conversation contact first regardless of message order', () => {
    const result = participantsFromThread({
      conversation: { contact_email: 'contact@example.com', contact_name: 'Casey' },
      messages: [
        { from_address: 'alice@example.com', from_name: 'Alice' },
      ],
      excludeEmails: [],
    });

    expect(result[0]).toEqual({ email: 'contact@example.com', name: 'Casey' });
  });

  it('dedupes by normalized email, first occurrence winning', () => {
    const result = participantsFromThread({
      conversation: null,
      messages: [
        { from_address: 'Alice@Example.com', from_name: 'Alice One' },
        { from_address: '  alice@example.com ', from_name: 'Alice Two' },
        { to_address: 'ALICE@EXAMPLE.COM' },
      ],
      excludeEmails: [],
    });

    expect(result).toEqual([{ email: 'alice@example.com', name: 'Alice One' }]);
  });

  it('adopts a later duplicate name when the kept entry has none', () => {
    const result = participantsFromThread({
      conversation: null,
      messages: [
        { to_address: 'alice@example.com' },
        { from_address: 'alice@example.com', from_name: 'Alice Adopted' },
      ],
      excludeEmails: [],
    });

    expect(result).toEqual([{ email: 'alice@example.com', name: 'Alice Adopted' }]);
  });

  it('adopts a name onto the conversation contact when the contact has no name', () => {
    const result = participantsFromThread({
      conversation: { contact_email: 'contact@example.com', contact_name: null },
      messages: [
        { from_address: 'contact@example.com', from_name: 'Named Later' },
      ],
      excludeEmails: [],
    });

    expect(result).toEqual([{ email: 'contact@example.com', name: 'Named Later' }]);
  });

  it('drops excluded emails case-insensitively', () => {
    const result = participantsFromThread({
      conversation: { contact_email: 'contact@example.com', contact_name: 'Casey' },
      messages: [
        {
          from_address: 'ALICE@Example.com',
          from_name: 'Alice',
          to_address: 'support@ourorg.com',
          cc_addresses: [{ email: 'Sales@OurOrg.com' }],
        },
      ],
      excludeEmails: ['alice@example.com', 'SUPPORT@OURORG.COM', 'sales@ourorg.com'],
    });

    expect(result).toEqual([{ email: 'contact@example.com', name: 'Casey' }]);
  });

  it('drops invalid emails', () => {
    const result = participantsFromThread({
      conversation: { contact_email: 'not-an-email', contact_name: 'Nobody' },
      messages: [
        { from_address: 'missing-at.example.com' },
        { to_address: 'no-tld@example' },
        { from_address: 'two words@example.com' },
        { to_address: '' },
        { from_address: null },
        { cc_addresses: [{ email: 'valid@example.com', name: 'Valid' }] },
      ],
      excludeEmails: [],
    });

    expect(result).toEqual([{ email: 'valid@example.com', name: 'Valid' }]);
  });

  it('caps the result at 50 participants', () => {
    const messages = Array.from({ length: 80 }, (_, i) => ({
      from_address: `person${i}@example.com`,
      from_name: `Person ${i}`,
    }));

    const result = participantsFromThread({
      conversation: { contact_email: 'contact@example.com', contact_name: 'Casey' },
      messages,
      excludeEmails: [],
    });

    expect(result).toHaveLength(50);
    expect(result[0]).toEqual({ email: 'contact@example.com', name: 'Casey' });
    // 49 message participants make the cut after the contact.
    expect(result[49]).toEqual({ email: 'person48@example.com', name: 'Person 48' });
  });

  it('handles a null conversation and empty messages', () => {
    expect(
      participantsFromThread({ conversation: null, messages: [], excludeEmails: [] }),
    ).toEqual([]);
  });
});
