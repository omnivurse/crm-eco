import { describe, expect, it } from 'vitest';
import {
  getConvertedContactId,
  isLeadRecordConverted,
  normalizeLeadConversionRpcResult,
} from './lead-conversion-result';

describe('normalizeLeadConversionRpcResult', () => {
  it('passes through successful conversion', () => {
    const out = normalizeLeadConversionRpcResult({
      success: true,
      contact_id: 'c1',
      contact_title: 'Jane Doe',
      message: 'Lead converted to contact successfully',
    });
    expect(out.success).toBe(true);
    expect(out.contact_id).toBe('c1');
  });

  it('treats already-converted as success with contact link', () => {
    const out = normalizeLeadConversionRpcResult({
      success: false,
      error: 'This lead has already been converted',
      converted_contact_id: 'c-existing',
    });
    expect(out.success).toBe(true);
    expect(out.already_converted).toBe(true);
    expect(out.contact_id).toBe('c-existing');
  });

  it('surfaces duplicate email merge path', () => {
    const out = normalizeLeadConversionRpcResult({
      success: false,
      error: 'A contact with email x@y.com already exists',
      existing_contact_id: 'dup-1',
    });
    expect(out.success).toBe(false);
    expect(out.suggest_merge).toBe(true);
    expect(out.existing_contact_id).toBe('dup-1');
  });
});

describe('isLeadRecordConverted', () => {
  it('detects converted_contact_id even when status is not Converted', () => {
    expect(
      isLeadRecordConverted({
        status: 'Active HS Member',
        data: { converted_contact_id: 'abc', is_converted: 'true' },
      }),
    ).toBe(true);
  });
});

describe('getConvertedContactId', () => {
  it('reads converted_contact_id from data', () => {
    expect(getConvertedContactId({ converted_contact_id: ' x ' })).toBe('x');
  });
});
