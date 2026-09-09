import { describe, expect, it } from 'vitest';
import {
  companyFromEmailDomain,
  displayNameFromEmail,
  emailConversationNotePrefix,
  extractPhone,
  extractWebsite,
  htmlToPlainText,
  isConversationNoteBlank,
  proposeContactFromParticipant,
  signatureBlock,
  splitPersonName,
} from './extract-contact-from-email';

describe('splitPersonName', () => {
  it('splits a first and last name', () => {
    expect(splitPersonName('Wendy Scipione')).toEqual({
      first_name: 'Wendy',
      last_name: 'Scipione',
    });
  });

  it('keeps extra last-name tokens', () => {
    expect(splitPersonName('Ada Augusta Lovelace')).toEqual({
      first_name: 'Ada',
      last_name: 'Augusta Lovelace',
    });
  });

  it('uses a single token as first name only', () => {
    expect(splitPersonName('Madonna')).toEqual({ first_name: 'Madonna', last_name: '' });
  });

  it('strips a bracketed email', () => {
    expect(splitPersonName('Ada Lovelace <ada@payitforwardhealth.com>')).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
  });
});

describe('displayNameFromEmail / companyFromEmailDomain', () => {
  it('title-cases a dotted local-part', () => {
    expect(displayNameFromEmail('frank.burnham@bankofcolorado.com')).toBe('Frank Burnham');
  });

  it('humanizes a hyphenated work domain', () => {
    expect(companyFromEmailDomain('pat@bank-of-colorado.com')).toBe('Bank Of Colorado');
  });

  it('does not invent a company from Gmail', () => {
    expect(companyFromEmailDomain('pat@gmail.com')).toBe('');
  });
});

describe('signatureBlock', () => {
  it('takes the text after an Outlook -- delimiter', () => {
    const body = [
      'Thanks for the call today.',
      '--',
      'Frank Burnham',
      'Relationship Manager',
      'Bank of Colorado',
      '303-555-0100',
    ].join('\n');
    expect(signatureBlock(body)).toContain('Frank Burnham');
    expect(signatureBlock(body)).toContain('Bank of Colorado');
    expect(signatureBlock(body)).not.toContain('Thanks for the call');
  });

  it('uses the lines above “Sent from my iPhone”', () => {
    const body = [
      'On my way.',
      'Dawn Marsh',
      'Enrollment desk',
      'Pay it Forward Health',
      'Sent from my iPhone',
    ].join('\n');
    const block = signatureBlock(body);
    expect(block).toContain('Dawn Marsh');
    expect(block).not.toContain('Sent from my iPhone');
  });
});

describe('extractPhone / extractWebsite', () => {
  it('reads a US phone and skips tracking links', () => {
    expect(extractPhone('Office 303-555-0199 please call')).toBe('303-555-0199');
    expect(
      extractWebsite('see https://list-manage.com/unsubscribe/abc and https://bankofcolorado.com'),
    ).toBe('https://bankofcolorado.com');
  });

  it('prefers a tel: link in HTML', () => {
    expect(extractPhone('no digits here', '<a href="tel:+13035550199">call</a>')).toBe('+13035550199');
  });
});

describe('proposeContactFromParticipant', () => {
  it('fills name, title, company, and phone from an inbound signature', () => {
    const proposed = proposeContactFromParticipant({
      participant: { email: 'frank.burnham@bankofcolorado.com', name: 'Frank Burnham' },
      messages: [
        {
          direction: 'inbound',
          from_address: 'frank.burnham@bankofcolorado.com',
          from_name: 'Frank Burnham',
          body_text: [
            'Wendy — good talking.',
            '--',
            'Frank Burnham',
            'Relationship Manager',
            'Bank of Colorado',
            '303-555-0100',
            'https://www.bankofcolorado.com',
          ].join('\n'),
        },
      ],
    });
    expect(proposed).toMatchObject({
      email: 'frank.burnham@bankofcolorado.com',
      first_name: 'Frank',
      last_name: 'Burnham',
      title: 'Relationship Manager',
      company: 'Bank of Colorado',
      phone: '303-555-0100',
      website: 'https://www.bankofcolorado.com',
    });
  });

  it('falls back to the email local-part and domain when there is no signature', () => {
    const proposed = proposeContactFromParticipant({
      participant: { email: 'frank.burnham@bank-of-colorado.com' },
      messages: [],
    });
    expect(proposed.first_name).toBe('Frank');
    expect(proposed.last_name).toBe('Burnham');
    expect(proposed.company).toBe('Bank Of Colorado');
    expect(proposed.phone).toBe('');
    expect(proposed.title).toBe('');
  });

  it('does not invent a title from a disclaimer-only body', () => {
    const proposed = proposeContactFromParticipant({
      participant: { email: 'legal@acme.com', name: 'Pat Legal' },
      messages: [
        {
          direction: 'inbound',
          from_address: 'legal@acme.com',
          body_text:
            'See attached.\nThis email and any attachments are confidential and privileged. Unsubscribe at https://list-manage.com/unsub/1',
        },
      ],
    });
    expect(proposed.title).toBe('');
    expect(proposed.website).toBe('');
  });
});

describe('htmlToPlainText', () => {
  it('turns breaks into newlines', () => {
    expect(htmlToPlainText('<p>Ada</p><br>Advisor')).toContain('Ada');
    expect(htmlToPlainText('<p>Ada</p><br>Advisor')).toContain('Advisor');
  });
});

describe('emailConversationNotePrefix', () => {
  it('stamps the subject and date', () => {
    expect(emailConversationNotePrefix('Re: ACH setup', '2026-09-08T16:00:00.000Z')).toMatch(
      /^Email: “ACH setup” — /,
    );
  });

  it('treats a prefix-only box as blank', () => {
    const prefix = emailConversationNotePrefix('Hello', null);
    expect(isConversationNoteBlank(prefix, prefix)).toBe(true);
    expect(isConversationNoteBlank(`${prefix}\nDiscussed wholesale rates.`, prefix)).toBe(false);
    expect(isConversationNoteBlank('   ', prefix)).toBe(true);
  });
});
