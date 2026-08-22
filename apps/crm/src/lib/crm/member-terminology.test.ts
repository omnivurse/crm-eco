import { describe, expect, it } from 'vitest';
import {
  ACTIVE_INSURANCE_CLIENT_STATUS,
  getConvertActionLabel,
  getCoreStatusPickerItems,
  getEnrollActionLabel,
  getMemberNoun,
  getMemberNounTitle,
  isActiveCoverageStatus,
  isInsuranceMarket,
  relabelStatusForMarket,
} from './member-terminology';

describe('member-terminology', () => {
  it('detects insurance markets', () => {
    expect(isInsuranceMarket('traditional_insurance')).toBe(true);
    expect(isInsuranceMarket('insurance')).toBe(true);
    expect(isInsuranceMarket('healthshare')).toBe(false);
  });

  it('relabels Active Member / Active for insurance only', () => {
    expect(relabelStatusForMarket('Active Member', 'traditional_insurance')).toBe(
      ACTIVE_INSURANCE_CLIENT_STATUS,
    );
    expect(relabelStatusForMarket('Active', 'traditional_insurance')).toBe(
      ACTIVE_INSURANCE_CLIENT_STATUS,
    );
    expect(relabelStatusForMarket('Active Member', 'healthshare')).toBe('Active Member');
    expect(relabelStatusForMarket('Active HS Member', 'traditional_insurance')).toBe(
      'Active HS Member',
    );
  });

  it('uses insurance convert labels', () => {
    expect(getConvertActionLabel('traditional_insurance')).toBe('Convert to Insurance Client');
    expect(getConvertActionLabel('healthshare')).toBe('Convert to Member');
    expect(getMemberNoun('traditional_insurance')).toBe('insurance client');
  });

  it('title-cases the noun for headings and builds the Enroll as… label', () => {
    expect(getMemberNounTitle('traditional_insurance')).toBe('Insurance Client');
    expect(getMemberNounTitle('healthshare')).toBe('Member');
    expect(getMemberNounTitle(null)).toBe('Member');
    expect(getEnrollActionLabel('traditional_insurance')).toBe('Enroll as Insurance Client');
    expect(getEnrollActionLabel('healthshare')).toBe('Enroll as Member');
  });

  it('exposes Active Insurance Client in the status picker', () => {
    // One vocabulary for every market — the variants are deliberately NOT
    // offered; a rep picking one by hand was the last way to re-create them.
    expect(getCoreStatusPickerItems('traditional_insurance')).not.toContain(
      ACTIVE_INSURANCE_CLIENT_STATUS,
    );
    expect(getCoreStatusPickerItems('healthshare')).not.toContain('Active Member');
    expect(getCoreStatusPickerItems('healthshare')).not.toContain('Active HS Member');
    expect(getCoreStatusPickerItems('healthshare')).not.toContain('In-Active');
    expect(getCoreStatusPickerItems('healthshare')).toContain('Active');
    expect(getCoreStatusPickerItems('healthshare')).toContain('Prospect');
  });

  it('treats Active Insurance Client as an active coverage status', () => {
    expect(isActiveCoverageStatus(ACTIVE_INSURANCE_CLIENT_STATUS)).toBe(true);
    expect(isActiveCoverageStatus('Pending')).toBe(false);
  });
});
