import { describe, expect, it } from 'vitest';
import {
  buildInboxContactData,
  conversationNoteToInsert,
  findThreadParticipant,
  overlayExtractedContact,
  resolveInboxContactCategory,
} from './inbox-contact-from-thread';

const extracted = {
  email: 'frank@bank.com',
  first_name: 'Frank',
  last_name: 'Burnham',
  phone: '303-555-0100',
  title: 'Relationship Manager',
  company: 'Bank of Colorado',
  website: '',
};

describe('findThreadParticipant', () => {
  it('accepts a From / To / Cc address and rejects a stranger', () => {
    const conversation = {
      contact_email: 'frank@bank.com',
      contact_name: 'Frank',
      mailbox_address: 'wendy@payitforwardhealth.com',
    };
    const messages = [
      {
        direction: 'inbound',
        from_address: 'frank@bank.com',
        from_name: 'Frank Burnham',
        to_address: 'wendy@payitforwardhealth.com',
        cc_addresses: [{ email: 'pat@vendor.com', name: 'Pat' }],
      },
    ];
    expect(findThreadParticipant(conversation, messages, 'FRANK@BANK.COM')?.email).toBe(
      'frank@bank.com',
    );
    expect(findThreadParticipant(conversation, messages, 'pat@vendor.com')?.name).toBe('Pat');
    expect(findThreadParticipant(conversation, messages, 'stranger@elsewhere.com')).toBeNull();
    expect(findThreadParticipant(conversation, messages, 'wendy@payitforwardhealth.com')).toBeNull();
  });
});

describe('overlay + payload', () => {
  it('lets the sheet override guessed fields and keeps Partner defaults', () => {
    const fields = overlayExtractedContact(extracted, { title: 'VP Lending', phone: '  ' });
    expect(fields.title).toBe('VP Lending');
    expect(fields.phone).toBe('303-555-0100');
    expect(buildInboxContactData(fields, resolveInboxContactCategory('Support Contact'))).toEqual({
      first_name: 'Frank',
      last_name: 'Burnham',
      email: 'frank@bank.com',
      phone: '303-555-0100',
      title: 'VP Lending',
      company: 'Bank of Colorado',
      contact_category: 'Support Contact',
      relationship_type: 'Partner',
      contact_status: 'Active',
    });
  });

  it('does not insert a note that is only the automatic header', () => {
    const prefix = 'Email: “ACH setup” — Sep 8, 2026';
    expect(conversationNoteToInsert(prefix, prefix)).toBeNull();
    expect(conversationNoteToInsert(`${prefix}\nTalked wholesale.`, prefix)).toBe(
      `${prefix}\nTalked wholesale.`,
    );
  });
});
