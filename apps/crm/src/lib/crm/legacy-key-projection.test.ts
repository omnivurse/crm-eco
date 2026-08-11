/**
 * Visibility regression gate.
 *
 * Every legacy key that live PIFH data is known to store MUST have exactly one
 * remedy so its value can reach the screen:
 *   - projection onto a defined canonical key (legacy-key-projection), or
 *   - the health-share bridge (lead-contact-sharing-fields), or
 *   - its own crm_fields definition (20260811190000_crm_legacy_field_definitions).
 *
 * If someone deletes an alias or drops a definition from the migration, this
 * test fails and the data goes invisible in CI rather than in front of a rep.
 * KNOWN_LEGACY_KEYS_IN_PROD is the audited inventory from prod on 2026-08-11
 * (`npm run audit:crm-visibility` regenerates the numbers).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  projectLegacyKeys,
  projectedLegacyKeysFor,
  DEFINE_ONLY_LEGACY_KEYS,
} from './legacy-key-projection';
import {
  SHARING_MEMBER_ID_LEGACY_KEYS,
  SHARING_EFFECTIVE_DATE_LEGACY_KEYS,
} from './lead-contact-sharing-fields';

/** Business keys observed populated in prod that had NO field definition. */
const KNOWN_LEGACY_KEYS_IN_PROD: Record<string, string[]> = {
  contacts: [
    'primary_member_gender', 'do_not_call', 'referral', 'source', 'state',
    'advisor_code', 'member_number', 'city', 'zip_code', 'advisor_name',
    'address_line1', 'producer_id', 'cancellation_reason', 'internal_id',
    'phone2', 'company_name', 'birth_month', 'scheduled_cancel_end_date',
    'address_line2', 'middle_initial', 'email2',
  ],
  members: [
    'do_not_call', 'referral', 'advisor_id', 'source', 'internal_id',
    'phone2', 'company_name', 'email2',
  ],
  leads: [
    'mailing_state', 'producer_name', 'producer_id', 'mailing_city',
    'mailing_zip', 'mailing_street',
  ],
  advisors: [
    'advisor_code', 'last_name', 'first_name', 'agent_role',
    'enrollment_code', 'agency_name', 'license_number', 'commission_tier',
  ],
};

const MIGRATION_NAME = '20260811190000_crm_legacy_field_definitions.sql';

/** Walk up from CWD so the gate works from the app dir or the repo root. */
function readMigration(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, 'supabase', 'migrations', MIGRATION_NAME);
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
    dir = path.dirname(dir);
  }
  throw new Error(
    `${MIGRATION_NAME} not found — the visibility gate cannot verify field definitions.`,
  );
}

const MIGRATION = readMigration();

/** Keys the health-share bridge already projects onto canonical HS fields. */
const HEALTHSHARE_BRIDGED = new Set<string>([
  ...SHARING_MEMBER_ID_LEGACY_KEYS,
  ...SHARING_EFFECTIVE_DATE_LEGACY_KEYS,
  'carrier', 'contact_status', 'monthly_premium', 'monthly_share', 'share_amount',
]);

describe('every known legacy key has a visibility remedy', () => {
  for (const [moduleKey, keys] of Object.entries(KNOWN_LEGACY_KEYS_IN_PROD)) {
    for (const key of keys) {
      it(`${moduleKey}.${key} is projected, bridged, or defined`, () => {
        const projected = projectedLegacyKeysFor(moduleKey).includes(key);
        const defined =
          (DEFINE_ONLY_LEGACY_KEYS[moduleKey] ?? []).includes(key) &&
          // the declared intent must actually exist in the shipped migration
          new RegExp(`'${moduleKey}',\\s*'${key}'`).test(MIGRATION);
        const bridged = HEALTHSHARE_BRIDGED.has(key);

        expect(
          projected || defined || bridged,
          `"${key}" on ${moduleKey} would be INVISIBLE: add a projection alias or a crm_fields definition`,
        ).toBe(true);
      });
    }
  }
});

describe('projectLegacyKeys', () => {
  it('fills a blank canonical key from its legacy twin (contacts)', () => {
    const base: Record<string, unknown> = {
      primary_member_gender: 'Female',
      city: 'Denver',
      state: 'CO',
      zip_code: '80202',
      address_line1: '123 Main St',
    };
    projectLegacyKeys(base, 'contacts');
    expect(base.gender).toBe('Female');
    expect(base.mailing_city).toBe('Denver');
    expect(base.mailing_state).toBe('CO');
    expect(base.mailing_zip).toBe('80202');
    expect(base.mailing_street).toBe('123 Main St');
  });

  it('never overwrites a populated canonical value', () => {
    const base: Record<string, unknown> = { mailing_city: 'Boulder', city: 'Denver' };
    projectLegacyKeys(base, 'contacts');
    expect(base.mailing_city).toBe('Boulder');
  });

  it('projects the opposite direction on leads (mailing_* -> plain)', () => {
    const base: Record<string, unknown> = { mailing_city: 'Denver', mailing_state: 'CO' };
    projectLegacyKeys(base, 'leads');
    expect(base.city).toBe('Denver');
    expect(base.state).toBe('CO');
  });

  it('treats blank strings as absent', () => {
    const base: Record<string, unknown> = { gender: '   ', primary_member_gender: 'Male' };
    projectLegacyKeys(base, 'contacts');
    expect(base.gender).toBe('Male');
  });

  it('is a no-op for unknown modules and repeated calls', () => {
    const base: Record<string, unknown> = { city: 'Denver' };
    projectLegacyKeys(base, 'accounts');
    expect(base.mailing_city).toBeUndefined();

    projectLegacyKeys(base, 'contacts');
    projectLegacyKeys(base, 'contacts');
    expect(base.mailing_city).toBe('Denver');
  });

  it('does NOT invent meaning: distinct concepts are never merged', () => {
    const base: Record<string, unknown> = {
      birth_month: 'March',
      middle_initial: 'Q',
      phone2: '555-0002',
    };
    projectLegacyKeys(base, 'contacts');
    // A birth MONTH must not become a date of birth, an initial must not
    // become a middle name, and a second phone is not necessarily a mobile.
    expect(base.date_of_birth).toBeUndefined();
    expect(base.middle_name).toBeUndefined();
    expect(base.mobile).toBeUndefined();
  });
});

describe('compliance', () => {
  it('do_not_call is defined for contacts AND members', () => {
    expect(/'contacts',\s*'do_not_call'/.test(MIGRATION)).toBe(true);
    expect(/'members',\s*'do_not_call'/.test(MIGRATION)).toBe(true);
  });
});

describe('modules that had zero field definitions', () => {
  it('advisors module gets a full field set', () => {
    for (const key of KNOWN_LEGACY_KEYS_IN_PROD.advisors) {
      expect(
        new RegExp(`'advisors',\\s*'${key}'`).test(MIGRATION),
        `advisors.${key} missing from the definitions migration`,
      ).toBe(true);
    }
  });
});
