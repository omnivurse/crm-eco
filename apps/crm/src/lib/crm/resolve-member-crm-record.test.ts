import { describe, expect, it } from 'vitest';
import {
  memberMatchesCrmRecord,
  normalizePhone,
  pickBestMemberCrmRecord,
  scoreMemberCrmRecordCoverage,
} from './resolve-member-crm-record';

const member = {
  id: 'c79f7587-a225-4be0-be9d-1b90b36159ca',
  first_name: 'Amber',
  last_name: 'Donnell',
  email: 'amberbdonnell@gmail.com',
  phone: '9407359792',
  member_number: '677333688',
};

describe('normalizePhone', () => {
  it('strips formatting characters', () => {
    expect(normalizePhone('940-735-9792')).toBe('9407359792');
  });
});

describe('memberMatchesCrmRecord', () => {
  it('matches on member_number even when indexed emails differ', () => {
    const result = memberMatchesCrmRecord(member, {
      id: '7fdce6a9-d020-43b1-b0cf-0578acd6cef3',
      email: 'adonnell@proton.me',
      data: {
        first_name: 'Amber',
        last_name: 'Donnell',
        member_number: '677333688',
      },
    });
    expect(result.matched).toBe(true);
    expect(result.reason).toBe('member_number');
  });

  it('matches on normalized phone + name', () => {
    const result = memberMatchesCrmRecord(member, {
      id: '7fdce6a9-d020-43b1-b0cf-0578acd6cef3',
      phone: '940-735-9792',
      data: { first_name: 'Amber', last_name: 'Donnell' },
    });
    expect(result.matched).toBe(true);
    expect(result.reason).toBe('phone_name');
  });

  it('matches on email when the candidate name identifies the same person', () => {
    const result = memberMatchesCrmRecord(member, {
      id: '7fdce6a9-d020-43b1-b0cf-0578acd6cef3',
      email: 'AMBERBDONNELL@gmail.com',
      data: { first_name: 'Amber', last_name: 'Donnell' },
    });

    expect(result.matched).toBe(true);
    expect(result.reason).toBe('email');
  });

  it('rejects a shared household email when the candidate name is different', () => {
    const result = memberMatchesCrmRecord(
      {
        ...member,
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'family@gmail.com',
      },
      {
        id: '287ff80f-fbc2-4829-b422-182d0fe429a8',
        email: 'family@gmail.com',
        data: { first_name: 'John', last_name: 'Smith' },
      },
    );

    expect(result).toEqual({ matched: false });
  });
});

describe('pickBestMemberCrmRecord', () => {
  it('prefers the Zoho contact over an enrollment_sync stub for Amber Donnell', () => {
    const stub = {
      id: '33da81e4-fd40-4448-8949-130ea4f68900',
      email: 'amberbdonnell@gmail.com',
      module_key: 'contacts',
      data: {
        first_name: 'Amber',
        last_name: 'Donnell',
        linked_member_id: member.id,
        source: 'enrollment_sync',
      },
    };
    const zoho = {
      id: '7fdce6a9-d020-43b1-b0cf-0578acd6cef3',
      email: 'adonnell@proton.me',
      source_record_id: 'zcrm_1579374000061091836',
      market_type: 'healthshare',
      module_key: 'contacts',
      data: {
        first_name: 'Amber',
        last_name: 'Donnell',
        member_number: '677333688',
        carrier: 'Zion Health',
        iua_amount: '2500',
        product: 'Secure HSA 2024 (42467)',
        secondary_email: 'amberbdonnell@gmail.com',
      },
    };

    expect(scoreMemberCrmRecordCoverage(zoho)).toBeGreaterThan(scoreMemberCrmRecordCoverage(stub));
    expect(pickBestMemberCrmRecord(member, [stub, zoho])?.id).toBe(zoho.id);
  });

  it('bridges Adam Davis Zoho contact via members-twin email2 when billing email differs', () => {
    const adamMember = {
      id: 'ecd41227-2d2c-408f-aefe-c0b5e6ac6075',
      first_name: 'Adam',
      last_name: 'Davis',
      email: 'adamwilliamdavis@hushmail.com',
      phone: '4844690124',
      member_number: '676898454',
    };
    const enrollmentStub = {
      id: '7edaaf3a-f444-4a66-aaae-4fceffe3eea9',
      email: 'adamwilliamdavis@hushmail.com',
      module_key: 'contacts',
      data: {
        first_name: 'Adam',
        last_name: 'Davis',
        linked_member_id: adamMember.id,
        member_number: '676898454',
        source: 'enrollment_sync',
      },
    };
    const membersTwin = {
      id: '564792a8-d76b-418e-a0b0-f11b1f002f46',
      email: 'adamwilliamdavis@hushmail.com',
      module_key: 'members',
      data: {
        first_name: 'Adam',
        last_name: 'Davis',
        member_number: '676898454',
        email2: 'adamwilliamdavis@gmail.com',
        address_line1: '2272 Nicholl Street East',
      },
    };
    const zoho = {
      id: '21f09b29-b53d-4042-8748-d2aa45311eab',
      email: 'adamwilliamdavis@gmail.com',
      source_record_id: 'zcrm_1579374000056599004',
      market_type: 'healthshare',
      module_key: 'contacts',
      data: {
        first_name: 'Adam',
        last_name: 'Davis',
        zoho_record_id: 'zcrm_1579374000056599004',
        product: 'Care Plus 2024 (42464)',
        coverage_option: 'Member Only',
        monthly_premium: '281.19',
        iua_amount: '1250',
        mailing_street: '105 Lansdowne Court',
      },
    };

    expect(pickBestMemberCrmRecord(adamMember, [enrollmentStub, membersTwin, zoho])?.id).toBe(
      zoho.id,
    );
  });

  it('does not resolve a member to another household member by shared email alone', () => {
    const janeMember = {
      id: '2e7d13cc-64fb-48f6-ab11-6d3170374a5f',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'family@gmail.com',
    };
    const johnZohoContact = {
      id: '287ff80f-fbc2-4829-b422-182d0fe429a8',
      email: 'family@gmail.com',
      source_record_id: 'zcrm_john',
      market_type: 'healthshare',
      module_key: 'contacts',
      data: {
        first_name: 'John',
        last_name: 'Smith',
        carrier: 'Zion Health',
        product: 'Direct Membership',
        monthly_premium: '450.00',
      },
    };

    expect(pickBestMemberCrmRecord(janeMember, [johnZohoContact])).toBeNull();
  });
});
