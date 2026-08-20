import { describe, expect, it } from 'vitest';
import { ENROLLED_BY_LABEL } from './coverage-snapshot-plan-fields';
import {
  canonicalEnrolledByKey,
  collapseOwnershipListColumns,
  enrolledByFormLabel,
  isVisibleEnrolledByField,
  preferredOwnershipListColumnKey,
  shouldShowOwnershipFieldInForm,
} from './ownership-field-dedupe';

const wendy = {
  producer_name: 'Wendy Scipione',
  producer: 'Wendy Scipione',
  advisor: 'Wendy Scipione',
  advisor_name: 'Wendy Scipione',
  agent: 'Wendy Scipione',
  lead_owner: 'Wendy Scipione',
  contact_owner: 'Wendy Scipione',
};

describe('canonicalEnrolledByKey', () => {
  it('uses producer on leads and producer_name elsewhere', () => {
    expect(canonicalEnrolledByKey('leads')).toBe('producer');
    expect(canonicalEnrolledByKey('contacts')).toBe('producer_name');
    expect(canonicalEnrolledByKey('members')).toBe('producer_name');
    expect(canonicalEnrolledByKey(null)).toBe('producer_name');
  });
});

describe('shouldShowOwnershipFieldInForm — screenshot duplicate case', () => {
  it('shows one Enrolled by when Wendy is on producer + advisor + agent', () => {
    const args = { moduleKey: 'contacts' as const, values: wendy };
    expect(shouldShowOwnershipFieldInForm({ ...args, fieldKey: 'producer_name' })).toBe(
      true,
    );
    expect(shouldShowOwnershipFieldInForm({ ...args, fieldKey: 'advisor' })).toBe(false);
    expect(shouldShowOwnershipFieldInForm({ ...args, fieldKey: 'advisor_name' })).toBe(
      false,
    );
    expect(shouldShowOwnershipFieldInForm({ ...args, fieldKey: 'agent' })).toBe(false);
    expect(shouldShowOwnershipFieldInForm({ ...args, fieldKey: 'producer' })).toBe(false);
    expect(shouldShowOwnershipFieldInForm({ ...args, fieldKey: 'lead_owner' })).toBe(
      false,
    );
    expect(enrolledByFormLabel('producer_name', 'contacts', wendy, 'Producer Name')).toBe(
      ENROLLED_BY_LABEL,
    );
  });

  it('hides empty aliases so "Add agent" does not sit next to a filled Enrolled by', () => {
    const values = { producer_name: 'Wendy Scipione', agent: '', advisor: '  ' };
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'agent',
        moduleKey: 'contacts',
        values,
      }),
    ).toBe(false);
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'advisor',
        moduleKey: 'contacts',
        values,
      }),
    ).toBe(false);
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'producer_name',
        moduleKey: 'contacts',
        values,
      }),
    ).toBe(true);
  });

  it('never hides owner_id', () => {
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'owner_id',
        moduleKey: 'contacts',
        values: wendy,
      }),
    ).toBe(true);
  });

  it('always shows canonical enrolled-by even when empty (create form)', () => {
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'producer_name',
        moduleKey: 'contacts',
        values: {},
      }),
    ).toBe(true);
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'producer',
        moduleKey: 'leads',
        values: {},
      }),
    ).toBe(true);
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'advisor',
        moduleKey: 'contacts',
        values: {},
      }),
    ).toBe(false);
  });
});

describe('shouldShowOwnershipFieldInForm — disagreeing aliases', () => {
  it('shows both producer and producer_name on a lead when they disagree', () => {
    const values = { producer: 'Pat Producer', producer_name: 'Wendy Scipione' };
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'producer',
        moduleKey: 'leads',
        values,
      }),
    ).toBe(true);
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'producer_name',
        moduleKey: 'leads',
        values,
      }),
    ).toBe(true);
    expect(isVisibleEnrolledByField('producer', 'leads', values)).toBe(true);
    expect(isVisibleEnrolledByField('producer_name', 'leads', values)).toBe(false);
  });

  it('shows a unique alias when canonical is empty', () => {
    const values = { producer_name: '', advisor: 'Adele Advisor' };
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'advisor',
        moduleKey: 'contacts',
        values,
      }),
    ).toBe(true);
    expect(isVisibleEnrolledByField('producer_name', 'contacts', values)).toBe(true);
    expect(isVisibleEnrolledByField('advisor', 'contacts', values)).toBe(false);
  });
});

describe('shouldShowOwnershipFieldInForm — normalized advisor vs agent', () => {
  it('hides normalized names that match canonical Enrolled by', () => {
    const values = {
      producer_name: 'Wendy Scipione',
      normalized_advisor_name: 'Wendy Scipione',
      normalized_agent_name: 'Wendy Scipione',
      market_type: 'healthshare',
    };
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'normalized_advisor_name',
        moduleKey: 'contacts',
        values,
      }),
    ).toBe(false);
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'normalized_agent_name',
        moduleKey: 'contacts',
        values,
      }),
    ).toBe(false);
  });

  it('never hides both normalized names when they differ', () => {
    const values = {
      producer_name: 'Pat Producer',
      normalized_advisor_name: 'Ann Advisor',
      normalized_agent_name: 'Al Agent',
      market_type: 'healthshare',
    };
    const showAdvisor = shouldShowOwnershipFieldInForm({
      fieldKey: 'normalized_advisor_name',
      moduleKey: 'leads',
      values,
    });
    const showAgent = shouldShowOwnershipFieldInForm({
      fieldKey: 'normalized_agent_name',
      moduleKey: 'leads',
      values,
    });
    expect(showAdvisor || showAgent).toBe(true);
    expect(showAdvisor).toBe(true);
    expect(showAgent).toBe(true);
  });

  it('shows only the market-appropriate normalized name when they match each other but not canonical', () => {
    const hs = {
      producer_name: 'Pat',
      normalized_advisor_name: 'Ann Advisor',
      normalized_agent_name: 'Ann Advisor',
      market_type: 'healthshare',
    };
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'normalized_advisor_name',
        moduleKey: 'contacts',
        values: hs,
      }),
    ).toBe(true);
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'normalized_agent_name',
        moduleKey: 'contacts',
        values: hs,
      }),
    ).toBe(false);

    const ins = { ...hs, market_type: 'traditional_insurance' };
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'normalized_agent_name',
        moduleKey: 'contacts',
        values: ins,
      }),
    ).toBe(true);
    expect(
      shouldShowOwnershipFieldInForm({
        fieldKey: 'normalized_advisor_name',
        moduleKey: 'contacts',
        values: ins,
      }),
    ).toBe(false);
  });
});

describe('collapseOwnershipListColumns', () => {
  it('keeps the first ownership column and drops later aliases', () => {
    expect(
      collapseOwnershipListColumns([
        'first_name',
        'advisor',
        'agent',
        'producer_name',
        'email',
      ]),
    ).toEqual(['first_name', 'advisor', 'email']);
  });

  it('prefers producer_name as the default list ownership column', () => {
    expect(
      preferredOwnershipListColumnKey(
        new Set(['advisor', 'agent', 'producer_name', 'email']),
      ),
    ).toBe('producer_name');
  });
});
