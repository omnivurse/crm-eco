import { describe, it, expect } from 'vitest';
import {
  projectAdultIntakeToMember,
  projectAdultIntakeToSnapshot,
  projectAdultIntakeToCustomFields,
  projectHouseholdToDependentRows,
  resolvePrimaryPhone,
} from '../adultIntakeProjection';

const sample = {
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'Jane.Doe@Example.com',
  date_of_birth: '1990-05-01',
  phone_cell: '555-111-2222',
  phone_home: '555-333-4444',
  leave_message_cell: true,
  preferred_contact: 'cell',
  may_contact_email: true,
  address_line1: '123 Main',
  city: 'Austin',
  state: 'TX',
  zip_code: '78701',
  relationship_status: 'Married',
  referral_source: 'Advisor',
  emergency_contact: {
    name: 'John Doe',
    relationship: 'Spouse',
    phone: '555-999-0000',
  },
};

describe('adultIntakeProjection', () => {
  it('resolves primary phone preferring cell', () => {
    expect(resolvePrimaryPhone(sample)).toBe('555-111-2222');
  });

  it('projects member insert with postal_code and phone2', () => {
    const m = projectAdultIntakeToMember(sample);
    expect(m.email).toBe('jane.doe@example.com');
    expect(m.phone).toBe('555-111-2222');
    expect(m.phone2).toBe('555-333-4444');
    expect(m.postal_code).toBe('78701');
    expect(m.state).toBe('TX');
  });

  it('projects snapshot and custom fields with emergency contact', () => {
    const snap = projectAdultIntakeToSnapshot(sample);
    expect(snap.first_name).toBe('Jane');
    expect(snap.emergency_contact?.name).toBe('John Doe');

    const cf = projectAdultIntakeToCustomFields(sample);
    expect(cf.preferred_contact).toBe('cell');
    expect((cf.emergency_contact as { phone: string }).phone).toBe('555-999-0000');
  });

  it('projects household to dependent rows', () => {
    const rows = projectHouseholdToDependentRows('org-1', 'mem-1', [
      {
        first_name: 'Kid',
        last_name: 'Doe',
        date_of_birth: '2015-01-01',
        relationship: 'child',
        lives_at_home: true,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].member_id).toBe('mem-1');
    expect(rows[0].same_address_as_member).toBe(true);
  });
});
