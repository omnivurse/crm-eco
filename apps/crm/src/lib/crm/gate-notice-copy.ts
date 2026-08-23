/**
 * Gate notices — the words for "we moved you, and here is why".
 *
 * A role gate that `redirect()`s without saying anything leaves the person on
 * a page they did not ask for, wondering what happened (PERM-viewer-gated-link:
 * /crm/import bounced a crm_viewer to /crm with `?error=no_import_permission`
 * and /crm never read it). The reason travels as a SHORT KEY in the query, and
 * this module is the only place that turns a key into words — so the gate, the
 * banner and the unit test cannot drift apart.
 *
 * Pure + isomorphic (no React, no next/*): the server page that redirects and
 * the client banner that renders both import it.
 */
import { toastCopy } from './toast-copy';

/**
 * Query-safe reason keys. `/crm?error=<key>` — never free text from a caller.
 * Every key here is one a CRM page already redirects with; adding a key
 * without adding its copy would put the silence straight back.
 */
export const CRM_GATE_REASON = {
  /** `/crm/import` refused: the page is crm_admin | crm_manager only. */
  noImportPermission: 'no_import_permission',
  /** `/crm/r/new` refused: crm_viewer (and unknown roles) cannot create. */
  noCreatePermission: 'no_create_permission',
  /** `/crm/imports/update` (Entity Reupload) refused: crm_admin | crm_manager only. */
  insufficientPermissions: 'insufficient_permissions',
  /** `/crm/duplicates` refused: crm_admin | crm_manager only. */
  adminOnly: 'admin_only',
  /**
   * `/crm/data-health` refused: crm_admin | crm_manager only.
   *
   * It needs its OWN key even though the gate is identical to Review
   * Duplicates': reusing `admin_only` told a bounced viewer "Couldn't open
   * Review Duplicates … Ask an admin to review the duplicates" after they
   * clicked Data Health — an explanation about a page they never asked for is
   * worse than none, because it sends them somewhere wrong.
   */
  dataHealthAdminOnly: 'data_health_admin_only',
} as const;

export type CrmGateReason = (typeof CRM_GATE_REASON)[keyof typeof CRM_GATE_REASON];

export interface CrmGateNoticeCopy {
  /** One line in the toastCopy voice: what could not be opened, and why. */
  title: string;
  /** Where the person is now and what they can do about it. */
  description: string;
}

const GATE_NOTICE_COPY: Record<CrmGateReason, CrmGateNoticeCopy> = {
  [CRM_GATE_REASON.noImportPermission]: {
    // "importing is limited to …" (not "you don't have permission to …") so
    // toastCopy.failed keeps the specific reason instead of collapsing it to
    // the generic no-access family, which talks about "this record".
    title: toastCopy.failed('open Import / Export', 'importing is limited to managers and admins'),
    description:
      "You're back on the dashboard — your role doesn't include import permission. Ask an admin to import for you.",
  },
  [CRM_GATE_REASON.noCreatePermission]: {
    title: toastCopy.failed('open the new-record form', 'your role is read-only'),
    description:
      "You're back on the dashboard — read-only roles can open records but not create them. Ask an admin for create permission.",
  },
  [CRM_GATE_REASON.insufficientPermissions]: {
    title: toastCopy.failed('open Update Import', 'bulk updates are limited to managers and admins'),
    description:
      "You're back on the dashboard — your role doesn't include update-import permission. Ask an admin to run it for you.",
  },
  [CRM_GATE_REASON.adminOnly]: {
    title: toastCopy.failed('open Review Duplicates', 'merging is limited to managers and admins'),
    description:
      "You're back on the dashboard — your role doesn't include merge permission. Ask an admin to review the duplicates.",
  },
  [CRM_GATE_REASON.dataHealthAdminOnly]: {
    title: toastCopy.failed('open Data Health', 'the data health report is limited to managers and admins'),
    description:
      "You're back on the dashboard — your role doesn't include permission to see the data health report. Ask an admin to check how clean the book is.",
  },
};

/**
 * Copy for a `?error=` value, or `null` when the value is missing or not one
 * we know. Unknown keys render nothing: the query string is user-controlled,
 * so it is never echoed into the page. Repeated params (`?error=a&error=b`)
 * arrive as an array — the first known value wins.
 */
export function crmGateNoticeCopy(
  reason: string | string[] | null | undefined,
): CrmGateNoticeCopy | null {
  const keys = Array.isArray(reason) ? reason : [reason];
  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const copy = GATE_NOTICE_COPY[key.trim() as CrmGateReason];
    if (copy) return copy;
  }
  return null;
}
