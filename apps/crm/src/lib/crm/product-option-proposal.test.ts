import { describe, expect, it } from 'vitest';
import {
  diffProposalAgainstOptions,
  normalizeOptionValueKey,
  PRODUCT_OPTION_PROPOSAL,
  PRODUCT_PROPOSAL_CENSUS_DATE,
  PRODUCT_PROPOSAL_FIELDS,
  type ProposedProductOption,
} from './product-option-proposal';

/** Minimal shape mirroring what /api/crm/field-options returns. */
interface TestOption {
  id: string;
  value: string;
  label: string;
  is_active: boolean;
}

function opt(value: string, is_active = true): TestOption {
  return { id: `id-${value}`, value, label: value, is_active };
}

const proposed = (value: string, display_order: number, count_total = 10): ProposedProductOption => ({
  value,
  label: value,
  display_order,
  count_total,
  count_by_module: { contacts: count_total },
});

describe('PRODUCT_OPTION_PROPOSAL (census snapshot integrity)', () => {
  it('carries exactly the 43 tier-A options', () => {
    expect(PRODUCT_OPTION_PROPOSAL).toHaveLength(43);
  });

  it('has unique values and contiguous display order 0..42', () => {
    const values = PRODUCT_OPTION_PROPOSAL.map((o) => normalizeOptionValueKey(o.value));
    expect(new Set(values).size).toBe(43);
    const orders = PRODUCT_OPTION_PROPOSAL.map((o) => o.display_order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 43 }, (_, i) => i));
  });

  it('every option carries the record count that justified it (tier-A floor is 10)', () => {
    for (const o of PRODUCT_OPTION_PROPOSAL) {
      expect(o.count_total).toBeGreaterThanOrEqual(10);
      expect(o.value.length).toBeGreaterThan(0);
      expect(o.label.length).toBeGreaterThan(0);
    }
  });

  it('names the census date and both target fields', () => {
    expect(PRODUCT_PROPOSAL_CENSUS_DATE).toMatch(/^2026-08-23T/);
    expect(PRODUCT_PROPOSAL_FIELDS.contacts.field_key).toBe('product');
    expect(PRODUCT_PROPOSAL_FIELDS.leads.field_key).toBe('product_type');
    expect(PRODUCT_PROPOSAL_FIELDS.contacts.field_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(PRODUCT_PROPOSAL_FIELDS.leads.field_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('normalizeOptionValueKey', () => {
  it('collapses case and whitespace but keeps punctuation', () => {
    expect(normalizeOptionValueKey('  Secure  HSA ')).toBe('secure hsa');
    expect(normalizeOptionValueKey('Co-Pay Plan (GROUP)')).toBe('co-pay plan (group)');
    expect(normalizeOptionValueKey('Co-Pay Plan')).not.toBe(normalizeOptionValueKey('Co-Pay Plan (GROUP)'));
  });

  it('returns empty for non-strings', () => {
    expect(normalizeOptionValueKey(null)).toBe('');
    expect(normalizeOptionValueKey(42)).toBe('');
  });
});

describe('diffProposalAgainstOptions', () => {
  const smallProposal = [proposed('Health Sharing', 0, 2654), proposed('Secure HSA', 1, 2604), proposed('Care Plus', 2, 1100)];

  it('empty current list: everything is missing, nothing present or extra', () => {
    const diff = diffProposalAgainstOptions([], smallProposal);
    expect(diff.alreadyPresent).toEqual([]);
    expect(diff.extra).toEqual([]);
    expect(diff.missing.map((o) => o.value)).toEqual(['Health Sharing', 'Secure HSA', 'Care Plus']);
  });

  it('empty current list against the real proposal offers all 43', () => {
    const diff = diffProposalAgainstOptions([]);
    expect(diff.missing).toHaveLength(43);
    expect(diff.missing[0].value).toBe('Health Sharing');
  });

  it('partial overlap: splits present from missing and keeps proposal order', () => {
    const current = [opt('Secure HSA')];
    const diff = diffProposalAgainstOptions(current, smallProposal);
    expect(diff.alreadyPresent).toHaveLength(1);
    expect(diff.alreadyPresent[0].proposal.value).toBe('Secure HSA');
    expect(diff.alreadyPresent[0].current).toBe(current[0]);
    expect(diff.missing.map((o) => o.value)).toEqual(['Health Sharing', 'Care Plus']);
    expect(diff.extra).toEqual([]);
  });

  it('case and whitespace differences still count as present (never re-add)', () => {
    const diff = diffProposalAgainstOptions([opt('secure  hsa'), opt(' HEALTH SHARING ')], smallProposal);
    expect(diff.alreadyPresent.map((p) => p.proposal.value)).toEqual(['Health Sharing', 'Secure HSA']);
    expect(diff.missing.map((o) => o.value)).toEqual(['Care Plus']);
    expect(diff.extra).toEqual([]);
  });

  it('a deactivated option is alreadyPresent, not missing — deactivation is a curation choice', () => {
    const deactivated = opt('Care Plus', false);
    const diff = diffProposalAgainstOptions([deactivated], smallProposal);
    expect(diff.missing.map((o) => o.value)).toEqual(['Health Sharing', 'Secure HSA']);
    expect(diff.alreadyPresent).toHaveLength(1);
    expect(diff.alreadyPresent[0].current.is_active).toBe(false);
  });

  it('an option the census never saw is extra and untouched', () => {
    const custom = opt('Client Special Plan');
    const diff = diffProposalAgainstOptions([custom, opt('Secure HSA')], smallProposal);
    expect(diff.extra).toEqual([custom]);
    expect(diff.missing.map((o) => o.value)).toEqual(['Health Sharing', 'Care Plus']);
  });

  it('missing preserves display_order even when the input proposal is shuffled', () => {
    const shuffled = [smallProposal[2], smallProposal[0], smallProposal[1]];
    const diff = diffProposalAgainstOptions([], shuffled);
    expect(diff.missing.map((o) => o.display_order)).toEqual([0, 1, 2]);
  });

  it('does not mutate its inputs', () => {
    const current = [opt('Secure HSA'), opt('Client Special Plan')];
    const snapshotCurrent = JSON.parse(JSON.stringify(current));
    const snapshotProposal = JSON.parse(JSON.stringify(smallProposal));
    diffProposalAgainstOptions(current, smallProposal);
    expect(current).toEqual(snapshotCurrent);
    expect(smallProposal).toEqual(snapshotProposal);
  });

  it('blank/duplicate current values do not collide or crash', () => {
    const diff = diffProposalAgainstOptions([opt(''), opt('Secure HSA'), opt('SECURE HSA')], smallProposal);
    // Both spellings normalize to the same key; the first wins the match, both are non-extra.
    expect(diff.alreadyPresent).toHaveLength(1);
    expect(diff.alreadyPresent[0].current.value).toBe('Secure HSA');
    expect(diff.extra.map((o) => o.value)).toEqual(['']);
  });
});
