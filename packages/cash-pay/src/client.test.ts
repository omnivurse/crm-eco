import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeRate,
  mapHclError,
  parseHclPagedBody,
  parseMsaAllowlist,
  stateFromZip,
  msasForState,
  getRateDataPaged,
  clearCache,
  CASH_PAY_CATALOG,
  specialtiesForSearch,
  resolveSpecialty,
  uniqueMsas,
} from './index';

describe('normalizeRate', () => {
  it('maps a documented ratesList row', () => {
    const row = normalizeRate({
      id: 101,
      hospitalID: 123,
      facilityName: 'General Hospital',
      planName: 'BlueCare',
      procedureCode: '99213',
      cmsRelativity: 1.25,
      paymentMethod: 'Negotiated',
      carrier: 'BlueCross',
      lob: 'Commercial',
      product: 'PPO',
      codeDescription: 'Office/outpatient visit',
      category: 'Outpatient',
      rate: 150.75,
      stateName: 'Texas',
      cityName: 'Dallas',
    });
    expect(row).toMatchObject({
      facilityName: 'General Hospital',
      rate: 150.75,
      procedureCode: '99213',
      city: 'Dallas',
      state: 'Texas',
    });
  });

  it('drops rows without a rate or facility', () => {
    expect(normalizeRate({ facilityName: 'X' })).toBeNull();
    expect(normalizeRate({ rate: 10 })).toBeNull();
  });
});

describe('mapHclError', () => {
  it('maps invalid key and mapping miss', () => {
    expect(mapHclError('Invalid Secret Key Or Invalid Parameters.', 401)).toBe('invalid_key');
    expect(mapHclError('No table mapping found for given StateName & MSAName')).toBe(
      'no_msa_mapping',
    );
  });
});

describe('parseHclPagedBody', () => {
  it('returns empty when success with no rates', () => {
    const parsed = parseHclPagedBody(
      { success: true, msg: 'Success', pageNumber: 1, pageSize: 25, totalCount: 0, ratesList: [] },
      200,
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('empty');
  });

  it('returns rates on happy path', () => {
    const parsed = parseHclPagedBody(
      {
        success: true,
        msg: 'Success',
        pageNumber: 1,
        pageSize: 50,
        totalCount: 1,
        hasMore: false,
        ratesList: [
          {
            id: 1,
            facilityName: 'General Hospital',
            rate: 100,
            procedureCode: '99284',
            codeDescription: 'ER visit',
            category: 'Outpatient',
            cityName: 'Portland',
            stateName: 'Oregon',
          },
        ],
      },
      200,
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.rates).toHaveLength(1);
    expect(parsed.rates[0].facilityName).toBe('General Hospital');
  });
});

describe('msa helpers', () => {
  it('parses allowlist JSON', () => {
    const list = parseMsaAllowlist(
      JSON.stringify([
        { stateName: 'Oregon', msaName: 'Portland-Salem OR-WA CMSA' },
        { stateName: 'Oregon', msaName: 'Eugene OR' },
        { bad: true },
      ]),
    );
    expect(list).toHaveLength(2);
    expect(msasForState(list, 'Oregon')).toHaveLength(2);
  });

  it('maps Oregon ZIP to state', () => {
    expect(stateFromZip('97201')).toBe('Oregon');
    expect(stateFromZip('abc')).toBeNull();
  });
});

describe('specialties', () => {
  it('includes hospital and pharmacy/RX in the catalog', () => {
    const ids = CASH_PAY_CATALOG.map((s) => s.id);
    expect(ids).toContain('hospital');
    expect(ids).toContain('pharmacy');
    expect(CASH_PAY_CATALOG.find((s) => s.id === 'pharmacy')?.codeHint).toBe('NDC');
  });

  it('uses requested specialty over allowlist default', () => {
    expect(resolveSpecialty({ stateName: 'Oregon', msaName: 'X', specialty: 'Hospital cash prices' }, 'Pharmacy')).toBe(
      'Pharmacy',
    );
  });

  it('dedupes MSAs and unions allowlist specialties', () => {
    const list = parseMsaAllowlist(
      JSON.stringify([
        { stateName: 'Oregon', msaName: 'Portland-Salem OR-WA CMSA', specialty: 'Hospital cash prices' },
        { stateName: 'Oregon', msaName: 'Portland-Salem OR-WA CMSA', specialty: 'Pharmacy' },
      ]),
    );
    expect(uniqueMsas(list)).toHaveLength(1);
    const specs = specialtiesForSearch(CASH_PAY_CATALOG, list);
    expect(specs.some((s) => s.hclName === 'Pharmacy')).toBe(true);
    expect(specs.some((s) => s.hclName === 'Hospital cash prices')).toBe(true);
  });
});

describe('getRateDataPaged', () => {
  beforeEach(() => clearCache());

  it('returns misconfigured without a key', async () => {
    const result = await getRateDataPaged(
      { stateName: 'Oregon', msaName: 'Portland-Salem OR-WA CMSA' },
      { secretKey: '', skipCache: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('misconfigured');
  });

  it('maps 401 invalid key', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ msg: 'Invalid Secret Key Or Invalid Parameters.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    const result = await getRateDataPaged(
      { stateName: 'Oregon', msaName: 'Portland-Salem OR-WA CMSA' },
      { secretKey: '00000000-0000-0000-0000-000000000000', fetchImpl, skipCache: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_key');
  });

  it('maps no table mapping', async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          success: false,
          msg: 'No table mapping found for given StateName & MSAName',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const result = await getRateDataPaged(
      { stateName: 'Oregon', msaName: 'Not A Real MSA' },
      { secretKey: '00000000-0000-0000-0000-000000000000', fetchImpl, skipCache: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('no_msa_mapping');
  });

  it('returns paged success', async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          success: true,
          msg: 'Success',
          pageNumber: 1,
          pageSize: 25,
          totalCount: 1,
          hasMore: false,
          ratesList: [
            {
              id: 9,
              facilityName: 'River Hospital',
              rate: 220,
              procedureCode: '70553',
              codeDescription: 'MRI brain',
              category: 'Outpatient',
              cityName: 'Portland',
              stateName: 'Oregon',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const result = await getRateDataPaged(
      { stateName: 'Oregon', msaName: 'Portland-Salem OR-WA CMSA', pageSize: 25 },
      { secretKey: '00000000-0000-0000-0000-000000000000', fetchImpl, skipCache: true },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rates[0].facilityName).toBe('River Hospital');
      expect(result.source).toBe('hcl');
    }
  });
});
