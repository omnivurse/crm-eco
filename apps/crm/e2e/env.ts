/**
 * Shared constants for the CRM click-walk harness.
 *
 * Everything here is LOCAL-stack only. The keys below are the public Supabase
 * CLI demo keys that every `supabase start` stack ships with — they are not
 * secrets and they only ever work against 127.0.0.1:54321.
 */
import path from 'node:path';

export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
export const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const BASE_URL = process.env.WALK_BASE_URL ?? 'http://localhost:3000';

/** Org the fixture lives in (PIFH tenant, local slug). */
export const PIFH_ORG_ID = '00000000-0000-0000-0000-000000000001';
export const PIFH_ORG_SLUG = 'pifh-local';

/** PIN disguise gate — mirrors packages/ui/src/lib/pin-lock.ts. */
export const PIN_COOKIE_NAME = 'lgq_ok';
export const PIN_LOCK_PATH = '/lock';
export const PIN_LOCK_TITLE = 'Lead Generation Quote System';
export const PIN_SESSION_MS = 12 * 60 * 60 * 1000;

/** Login + MFA surfaces — mirrors apps/crm/src/app/crm-login and lib/security/mfa.ts. */
export const LOGIN_PATH = '/crm-login';
export const MFA_STEP_UP_PATH = '/crm-login/mfa';

export type WalkRole = 'operator' | 'admin' | 'viewer';

/** FIXTURE CONTRACT — shared with scripts/e2e (seed). Both sides must agree. */
export const FIXTURE = {
  users: {
    operator: { email: 'walk-operator@example.invalid', password: 'Walk-Operator-2026!', crmRole: 'crm_agent' },
    admin: { email: 'walk-admin@example.invalid', password: 'Walk-Admin-2026!', crmRole: 'crm_admin' },
    viewer: { email: 'walk-viewer@example.invalid', password: 'Walk-Viewer-2026!', crmRole: 'crm_viewer' },
  } as const satisfies Record<WalkRole, { email: string; password: string; crmRole: string }>,
  anchor: {
    firstName: 'Wendy',
    lastName: 'Walker',
    phone: '5550107788',
    email: 'wendy.walker@example.invalid',
    memberNumber: 'WALK-0001',
    sharingEffectiveDate: '2026-09-01',
    producerName: 'Wen Producer',
    moduleKey: 'contacts',
  },
  pendingOldest: { name: 'Pat Pending', phone: '5550107701' },
  lead: { name: 'Lee Lead' },
  advisor: { name: 'Wen Producer' },
  minContacts: 32,
  listPageSize: 25,
} as const;

/** Active-lane statuses — mirrors apps/crm/src/lib/crm/resolve-effective-end-date.ts. */
export const ACTIVE_LANE_STATUSES = [
  'Active',
  'Active HS Member',
  'Active Member',
  'Active Insurance Client',
  'Active DPC',
] as const;

/**
 * Negative-run switches (EV-3 acceptance) — each one makes the walk FAIL on a
 * named trap, never pass. Documented in docs/ux/click-walk.md "Proving the traps".
 *   E2E_SKIP_PIN_COOKIE=1        global-setup arms NO lgq_ok cookie      → TRAP:pin-gate
 *   E2E_ANCHOR_PHONE=<digits>    not-empty looks for this phone instead   → TRAP:not-empty
 *   E2E_FORCE_VIEWPORT_WIDTH=N   desktop project + setup viewport width N → TRAP:breakpoint (N<1024)
 */
export const NEGATIVE = {
  skipPinCookie: process.env.E2E_SKIP_PIN_COOKIE === '1',
  anchorPhoneOverride: process.env.E2E_ANCHOR_PHONE?.trim() || null,
  forceViewportWidth: parseForcedWidth(process.env.E2E_FORCE_VIEWPORT_WIDTH),
} as const;

function parseForcedWidth(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 320 || n > 4096) {
    throw new Error(`E2E_FORCE_VIEWPORT_WIDTH must be an integer 320..4096 (got "${raw}")`);
  }
  return n;
}

/** The phone the not-empty trap searches for (the fixture anchor unless E2E_ANCHOR_PHONE overrides it). */
export function anchorPhone(): string {
  return NEGATIVE.anchorPhoneOverride ?? FIXTURE.anchor.phone;
}

/** Desktop viewport for global-setup and the desktop-1440 project (E2E_FORCE_VIEWPORT_WIDTH overrides the width). */
export function desktopViewport(): { width: number; height: number } {
  return { width: NEGATIVE.forceViewportWidth ?? 1440, height: 900 };
}

export function walkRole(): WalkRole {
  const raw = (process.env.WALK_ROLE ?? 'operator').trim().toLowerCase();
  if (raw === 'operator' || raw === 'admin' || raw === 'viewer') return raw;
  throw new Error(`WALK_ROLE must be operator|admin|viewer (got "${raw}")`);
}

export const E2E_DIR = __dirname;
export const AUTH_DIR = path.join(E2E_DIR, '.auth');
export const ARTIFACTS_DIR = path.join(E2E_DIR, 'artifacts');
export const WALK_ROOT = path.join(ARTIFACTS_DIR, 'crm-walk');
export const REPORT_DIR = path.join(E2E_DIR, 'report');
export const WALK_SCHEMA_PATH = path.join(REPORT_DIR, 'walk-schema.json');

export function authStatePath(role: WalkRole = walkRole()): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

/** The per-run artifact folder; globalSetup creates it and exports WALK_RUN_DIR. */
export function runDir(): string {
  const dir = process.env.WALK_RUN_DIR;
  if (!dir) throw new Error('WALK_RUN_DIR is not set — the walk must run through e2e/playwright.config.ts (globalSetup).');
  return dir;
}

export function isLocalSupabaseHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return false;
  }
}
