/**
 * Shared tenant cookie / header constants.
 * App-specific resolvers (CRM, Admin, Portal) import these so org-switch
 * stays synchronized across hosts. Full resolveActiveTenant lives in each
 * app until host-map adapters are unified (see architecture plan Phase 3).
 */

export const ACTIVE_ORG_COOKIE = 'dh_active_org';
export const ACTIVE_ORG_HEADER = 'x-active-org';

export type TenantRole = 'owner' | 'super_admin' | 'admin' | 'staff' | 'read_only';
