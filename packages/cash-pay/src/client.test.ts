import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeRate,
  mapHclError,
  parseHclPagedBody,
  parseMsaAllowlist,
  stateFromZip,
  msasForState,
  clearCache,
  CASH_PAY_CATALOG,
  specialtiesForSearch,
  resolveSpecialty,
  uniqueMsas,
  pickPreferredState,
  hclStateForZip,
  normalizeStateName,
  loadFullHclCatalog,
  loadHclCatalog,
  loadMsaAllowlistFromEnv,
  uniqueStates,
  resolveRateQuery,
  resolvePreferredMarket,
  resolveLiveSpecialty,
  summarizeResultSlice,
} from './index';
import { getRateDataPaged } from './client';

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
    expect(mapHclError("Could not find stored procedure 'Sp_Expose_Api_Rates_Paged'.", 400)).toBe(
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

  it('maps Alabama ZIP to state', () => {
    expect(stateFromZip('35203')).toBe('Alabama');
  });

  it('maps CA and TX ZIPs to HCL regions', () => {
    expect(hclStateForZip('97201')).toBe('Oregon');
    expect(hclStateForZip('35203')).toBe('Alabama');
    expect(hclStateForZip('90210')).toBe('CA-S California');
    expect(hclStateForZip('94102')).toBe('CA-N California');
    expect(hclStateForZip('75201')).toBe('TX-North Texas DFW');
    expect(hclStateForZip('77001')).toBe('TX-Central Southeast');
    expect(hclStateForZip('78205')).toBe('TX-South Texas');
    expect(hclStateForZip('79401')).toBe('TX-Panhandle West Texas');
  });

  it('preserves HCL regional state names', () => {
    expect(normalizeStateName('CA-S California')).toBe('CA-S California');
    expect(normalizeStateName('TX-North Texas DFW')).toBe('TX-North Texas DFW');
    expect(normalizeStateName('OR')).toBe('Oregon');
  });

  it('prefers an allowlisted state and ignores off-key markets', () => {
    const list = parseMsaAllowlist(
      JSON.stringify([
        {
          stateName: 'Alabama',
          msaName: 'Birmingham - Huntsville - Gadsden',
          specialty: 'Hospital cash prices',
        },
      ]),
    );
    expect(pickPreferredState(list, ['Oregon', 'AL', null])).toBe('Alabama');
    expect(pickPreferredState(list, [null, '97201'])).toBe('Alabama');
    expect(pickPreferredState(list, ['Alabama'])).toBe('Alabama');
  });

  it('loads the nationwide HCL catalog and prefers CA/TX regions', () => {
    const catalog = loadFullHclCatalog();
    const states = uniqueStates(catalog);
    expect(catalog.length).toBeGreaterThanOrEqual(200);
    expect(states.length).toBeGreaterThanOrEqual(50);
    expect(states).toContain('Oregon');
    expect(states).toContain('CA-S California');
    expect(states).toContain('TX-North Texas DFW');
    expect(pickPreferredState(catalog, ['California'])).toBe('CA-S California');
    expect(pickPreferredState(catalog, [hclStateForZip('94102')])).toBe('CA-N California');
    expect(pickPreferredState(catalog, [hclStateForZip('75201')])).toBe('TX-North Texas DFW');
  });

  it('exposes loadHclCatalog as the nationwide catalog loader', () => {
    expect(loadHclCatalog().length).toBeGreaterThan(200);
    expect(loadHclCatalog()).toEqual(loadMsaAllowlistFromEnv());
  });

  it('uses the bundled catalog unless HCL_MSA_ALLOWLIST_ONLY=1', () => {
    const envOnly = loadMsaAllowlistFromEnv({
      HCL_MSA_ALLOWLIST: JSON.stringify([
        { stateName: 'Oregon', msaName: 'Portland-Salem' },
      ]),
      HCL_MSA_ALLOWLIST_ONLY: '1',
    });
    expect(envOnly).toHaveLength(1);
    expect(envOnly[0].msaName).toBe('Portland-Salem');

    const merged = loadMsaAllowlistFromEnv({
      HCL_MSA_ALLOWLIST: JSON.stringify([
        { stateName: 'Oregon', msaName: 'Portland-Salem' },
      ]),
    });
    expect(merged.length).toBeGreaterThan(200);
    expect(uniqueStates(merged)).toContain('Florida');
  });
});

describe('resolveRateQuery', () => {
  const catalog = loadFullHclCatalog();

  it('accepts a catalog-legal Oregon metro', () => {
    const q = resolveRateQuery({
      allowlist: catalog,
      state: 'Oregon',
      msa: 'Portland-Salem',
    });
    expect(q.ok).toBe(true);
    if (q.ok) {
      expect(q.stateName).toBe('Oregon');
      expect(q.msaName).toBe('Portland-Salem');
      expect(q.specialty).toBe('Hospital cash prices');
    }
  });

  it('infers CA-S from a Los Angeles ZIP', () => {
    const q = resolveRateQuery({
      allowlist: catalog,
      zip: '90210',
      msa: 'Los Angeles - Long Beach - Santa Ana',
    });
    if (!q.ok) {
      const metros = catalog.filter((e) => e.stateName === 'CA-S California').map((e) => e.msaName);
      const q2 = resolveRateQuery({
        allowlist: catalog,
        zip: '90210',
        msa: metros[0],
      });
      expect(q2.ok).toBe(true);
      if (q2.ok) expect(q2.stateName).toBe('CA-S California');
      return;
    }
    expect(q.stateName).toBe('CA-S California');
  });

  it('rejects a metro that is not on the catalog', () => {
    const q = resolveRateQuery({
      allowlist: catalog,
      state: 'Oregon',
      msa: 'Not A Real Metro',
    });
    expect(q.ok).toBe(false);
    if (!q.ok) expect(q.code).toBe('no_msa_mapping');
  });

  it('rejects an invalid ZIP', () => {
    const q = resolveRateQuery({
      allowlist: catalog,
      zip: '972',
      state: 'Oregon',
      msa: 'Portland-Salem',
    });
    expect(q.ok).toBe(false);
    if (!q.ok) expect(q.code).toBe('invalid_input');
  });

  it('coerces Pharmacy to a live specialty', () => {
    const live = specialtiesForSearch(CASH_PAY_CATALOG, catalog);
    expect(live.every((s) => s.hclName !== 'Pharmacy')).toBe(true);
    const specialty = resolveLiveSpecialty(live, catalog[0], 'Pharmacy');
    expect(specialty).toBe('Hospital cash prices');
  });

  it('prefers ZIP region for dropdown defaults', () => {
    const pref = resolvePreferredMarket({ allowlist: catalog, zip: '94102' });
    expect(pref.stateName).toBe('CA-N California');
  });

  it('maps Oregon 97201 to Portland-Salem, not the first catalog metro', () => {
    const pref = resolvePreferredMarket({ allowlist: catalog, zip: '97201' });
    expect(pref.stateName).toBe('Oregon');
    expect(pref.msaName).toBe('Portland-Salem');
  });
});

describe('summarizeResultSlice', () => {
  it('separates slice extrema from file size', () => {
    const summary = summarizeResultSlice(
      [
        { rate: 100, cmsRelativity: 1.1 },
        { rate: 300, cmsRelativity: 2.0 },
        { rate: 200, cmsRelativity: 1.4 },
      ],
      3_790_000,
    );
    expect(summary.scope).toBe('slice');
    expect(summary.sliceCount).toBe(3);
    expect(summary.low).toBe(100);
    expect(summary.median).toBe(200);
    expect(summary.high).toBe(300);
    expect(summary.cmsMin).toBe(1.1);
    expect(summary.cmsMax).toBe(2);
    expect(summary.fileSize).toBe(3_790_000);
  });

  it('handles an empty slice without inventing rates', () => {
    const summary = summarizeResultSlice([], 12);
    expect(summary.low).toBeNull();
    expect(summary.median).toBeNull();
    expect(summary.high).toBeNull();
    expect(summary.fileSize).toBe(12);
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

  it('does not list catalog specialties the key has not mapped', () => {
    const list = parseMsaAllowlist(
      JSON.stringify([
        {
          stateName: 'Alabama',
          msaName: 'Birmingham - Huntsville - Gadsden',
          specialty: 'Hospital cash prices',
        },
      ]),
    );
    const specs = specialtiesForSearch(CASH_PAY_CATALOG, list);
    expect(specs).toHaveLength(1);
    expect(specs[0].hclName).toBe('Hospital cash prices');
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

const live = process.env.HCL_LIVE_PROBE === '1';

describe.skipIf(!live)('live GetRateDataPaged', () => {
  it('returns Alabama hospital cash prices', async () => {
    const result = await getRateDataPaged(
      {
        stateName: 'Alabama',
        msaName: 'Birmingham - Huntsville - Gadsden',
        specialty: 'Hospital cash prices',
        pageNumber: 1,
        pageSize: 5,
        procedureCode: '10005',
      },
      { skipCache: true },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rates.length).toBeGreaterThan(0);
      expect(result.rates[0].facilityName.length).toBeGreaterThan(0);
      expect(result.rates[0].rate).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
    }
  });

  it('returns Oregon Portland-Salem hospital cash prices', async () => {
    const result = await getRateDataPaged(
      {
        stateName: 'Oregon',
        msaName: 'Portland-Salem',
        specialty: 'Hospital cash prices',
        pageNumber: 1,
        pageSize: 5,
        procedureCode: '99213',
      },
      { skipCache: true },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rates.length).toBeGreaterThan(0);
      expect(result.rates[0].facilityName.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
    }
  });
});
