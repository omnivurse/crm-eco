/**
 * Quick-create config + pure helpers for the QuickCreateDrawer.
 *
 * The client's most frequent task is hand-entering a new member from another
 * enrollment system: ~12 fields, pasted in a fixed order. This module owns
 *   - which `crm_fields` keys each quick form shows (and in what tab order),
 *   - the labels the client already knows ("Add Member", "Who enrolled", …),
 *   - the pure handoff into the full form's sessionStorage draft
 *     (`RecordDraftAutosave` reads `crm:newdraft:<orgId>:<moduleKey>`),
 *   - small validation / phone helpers used for duplicate lookups.
 *
 * Nothing here touches the network or the DOM (except `writeQuickCreateDraft`,
 * which is a thin sessionStorage writer). Client-safe.
 */

import { isPendingContactStatus } from '@/lib/crm/pending-activation';
import { maskDateTyping } from '@/lib/crm/date-field-bounds';

export type QuickCreateModuleKey = 'contacts' | 'leads' | 'accounts';

export const QUICK_CREATE_MODULE_KEYS: readonly QuickCreateModuleKey[] = [
  'contacts',
  'leads',
  'accounts',
] as const;

export type QuickCreateFieldType = 'text' | 'email' | 'tel' | 'date' | 'select';

export interface QuickCreateField {
  /** `crm_fields.key` — the JSONB key written on the record. */
  key: string;
  /** Label the client knows (may differ from crm_fields.label). */
  label: string;
  /** Small muted hint rendered next to the label ("Who enrolled"). */
  hint?: string;
  type: QuickCreateFieldType;
  required?: boolean;
  placeholder?: string;
  /** Preselected value for selects (only applied when the field is empty). */
  defaultValue?: string;
  /**
   * For selects: options are sourced from the live `crm_fields.options` for
   * this key when the fields endpoint is reachable; `fallbackOptions` is used
   * only until they load / if the request fails. When both are empty the
   * select degrades to a text input so nothing blocks the user.
   */
  fallbackOptions?: string[];
  /** Render this select only when crm_fields actually has options for it. */
  optionalIfNoOptions?: boolean;
  /** Full-width in the two-column grid. */
  span?: 1 | 2;
}

export interface QuickCreateModuleConfig {
  key: QuickCreateModuleKey;
  /** Sheet title / button label ("Add Member"). */
  title: string;
  /** Noun for toasts ("Member"). */
  noun: string;
  /** Description under the title. */
  description: string;
  /** Which JSONB key carries the record status (drives Pending→start-date rule). */
  statusKey?: string;
  /** Which JSONB key is the coverage effective/start date. */
  effectiveDateKey?: string;
  fields: QuickCreateField[];
}

/**
 * Field order == the paste order the client uses when copying from the other
 * enrollment system. Tab order in the drawer follows this array exactly.
 */
export const QUICK_CREATE_FIELDS: Record<QuickCreateModuleKey, QuickCreateModuleConfig> = {
  contacts: {
    key: 'contacts',
    title: 'Add Member',
    noun: 'Member',
    description: 'The essentials from the enrollment. Everything else can be added later.',
    statusKey: 'contact_status',
    effectiveDateKey: 'sharing_effective_date',
    fields: [
      { key: 'first_name', label: 'First name', type: 'text', required: true },
      { key: 'last_name', label: 'Last name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'tel', placeholder: '(555) 555-5555' },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'Optional' },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'mailing_city', label: 'City', type: 'text' },
      { key: 'mailing_state', label: 'State', type: 'text', placeholder: 'e.g. TX' },
      { key: 'product', label: 'Plan', type: 'text' },
      { key: 'sharing_effective_date', label: 'Effective date', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'producer_name', label: 'Producer Name', hint: 'Who enrolled', type: 'text' },
      { key: 'referring_member', label: 'Referring member', type: 'text' },
      { key: 'member_number', label: 'Member #', type: 'text' },
      {
        key: 'contact_status',
        label: 'Status',
        type: 'select',
        defaultValue: 'Pending',
        fallbackOptions: ['Active', 'Inactive', 'Pending', 'Cancelled', 'Deceased', 'Terminated'],
      },
      {
        key: 'sharing_entity',
        label: 'Sharing entity',
        type: 'select',
        optionalIfNoOptions: true,
      },
    ],
  },
  leads: {
    key: 'leads',
    title: 'Add Lead',
    noun: 'Lead',
    description: 'Capture the lead now; the full form is one click away.',
    statusKey: 'lead_status',
    effectiveDateKey: 'sharing_effective_date',
    fields: [
      { key: 'first_name', label: 'First name', type: 'text', required: true },
      { key: 'last_name', label: 'Last name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'tel', placeholder: '(555) 555-5555' },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'Optional' },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text', placeholder: 'e.g. TX' },
      { key: 'product_type', label: 'Plan', type: 'text' },
      { key: 'sharing_effective_date', label: 'Effective date', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'producer', label: 'Producer', hint: 'Who enrolled', type: 'text' },
      { key: 'referring_member', label: 'Referring member', type: 'text' },
      {
        key: 'lead_status',
        label: 'Status',
        type: 'select',
        defaultValue: 'New',
        fallbackOptions: ['New', 'Contacted', 'In Process', 'Qualified', 'Future Prospect', 'Pending', 'Converted', 'Unqualified', 'Lost'],
      },
      {
        key: 'sharing_entity',
        label: 'Sharing entity',
        type: 'select',
        optionalIfNoOptions: true,
      },
    ],
  },
  accounts: {
    key: 'accounts',
    title: 'Add Account',
    noun: 'Account',
    description: 'A company or group record.',
    fields: [
      { key: 'name', label: 'Account name', type: 'text', required: true, span: 2 },
      { key: 'website', label: 'Website', type: 'text', placeholder: 'https://' },
      { key: 'industry', label: 'Industry', type: 'text' },
    ],
  },
};

export function isQuickCreateModuleKey(key: string | null | undefined): key is QuickCreateModuleKey {
  return !!key && (QUICK_CREATE_MODULE_KEYS as readonly string[]).includes(key);
}

/** Initial form values for a module: select defaults only, everything else blank. */
export function initialQuickCreateValues(moduleKey: QuickCreateModuleKey): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of QUICK_CREATE_FIELDS[moduleKey].fields) {
    if (f.defaultValue) out[f.key] = f.defaultValue;
  }
  return out;
}

/** True when the user has typed anything beyond the select defaults. */
export function isQuickCreateDirty(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): boolean {
  const initial = initialQuickCreateValues(moduleKey);
  return Object.entries(values).some(([k, v]) => (v ?? '').trim() !== '' && (initial[k] ?? '') !== v);
}

/** Labels of required fields that are still blank. */
export function missingRequiredQuickCreateFields(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): string[] {
  return QUICK_CREATE_FIELDS[moduleKey].fields
    .filter((f) => f.required && !(values[f.key] ?? '').trim())
    .map((f) => f.label);
}

/**
 * The server rejects Pending-class statuses without a coverage start date
 * (`assertCrmPendingHasStartDate`). Surface that BEFORE the round-trip so the
 * user is told which field to fill instead of getting a generic failure.
 */
export function quickCreatePendingNeedsEffectiveDate(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): boolean {
  const cfg = QUICK_CREATE_FIELDS[moduleKey];
  if (!cfg.statusKey || !cfg.effectiveDateKey) return false;
  const status = values[cfg.statusKey];
  if (!isPendingContactStatus(status)) return false;
  return !(values[cfg.effectiveDateKey] ?? '').trim();
}

/** Digits only — "(555) 123-4567" → "5551234567". Drops a leading US "1". */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

/**
 * `check_crm_duplicate` compares `crm_records.phone` with plain string
 * equality and prod stores phones in mixed formats (10 digits, 555-555-5555,
 * (555) 555-5555). Until the RPC compares digits-only, look the number up in
 * each stored shape. Returns unique, non-empty candidates (as-typed first).
 */
export function phoneLookupVariants(phone: string | null | undefined): string[] {
  const typed = String(phone ?? '').trim();
  const digits = normalizePhoneDigits(typed);
  const out: string[] = [];
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };
  push(typed);
  if (digits.length === 10) {
    push(digits);
    push(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
    push(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
  } else if (digits) {
    push(digits);
  }
  return out;
}

/**
 * Data payload for POST /api/crm/records: trimmed strings, empties dropped
 * (never write "" over a field the full form would leave null), and date
 * fields masked to MM/DD/YYYY — the server normalises to ISO on save via
 * `sanitizeCrmDataJsonPatch`, exactly like the full form.
 */
export function buildQuickCreatePayload(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of QUICK_CREATE_FIELDS[moduleKey].fields) {
    const raw = (values[f.key] ?? '').trim();
    if (!raw) continue;
    out[f.key] = f.type === 'date' ? maskDateTyping(raw) : raw;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Draft handoff → full form (RecordDraftAutosave)
// ---------------------------------------------------------------------------

/** Mirrors `DraftPayload` in RecordDraftAutosave.tsx — keep in sync. */
export interface QuickCreateDraftPayload {
  updatedAt: number;
  values: Record<string, unknown>;
}

const DRAFT_STORAGE_PREFIX = 'crm:newdraft:';

/**
 * sessionStorage key the full form reads on mount. The new-record page mounts
 * `RecordDraftAutosave` with `storageScope={profile.organization_id}`, so the
 * key is `crm:newdraft:<orgId>:<moduleKey>`; without an org id it falls back
 * to the unscoped `crm:newdraft:<moduleKey>`.
 */
export function quickCreateDraftStorageKey(moduleKey: string, orgId?: string | null): string {
  return `${DRAFT_STORAGE_PREFIX}${orgId ? `${orgId}:` : ''}${moduleKey}`;
}

/** Build the exact payload shape RecordDraftAutosave expects; blanks dropped. */
export function buildQuickCreateDraft(
  values: Record<string, string>,
  now: number = Date.now(),
): QuickCreateDraftPayload {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v == null) continue;
    const t = String(v).trim();
    if (!t) continue;
    cleaned[k] = t;
  }
  return { updatedAt: now, values: cleaned };
}

/**
 * Persist the quick-create values as the full form's draft. Returns false when
 * there is nothing worth carrying over or storage is unavailable — the caller
 * still navigates; the user just starts from a blank full form.
 */
export function writeQuickCreateDraft(
  moduleKey: string,
  orgId: string | null | undefined,
  values: Record<string, string>,
): boolean {
  if (typeof window === 'undefined') return false;
  const payload = buildQuickCreateDraft(values);
  if (Object.keys(payload.values).length === 0) return false;
  try {
    const key = quickCreateDraftStorageKey(moduleKey, orgId);
    // Never clobber an in-progress full-form draft for the same module:
    // merge, drawer values win per key. (RecordDraftAutosave writes the same
    // key while the user types on the full form.)
    let merged = payload;
    const existingRaw = window.sessionStorage.getItem(key);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as { updatedAt?: unknown; values?: unknown } | null;
        if (
          existing &&
          typeof existing === 'object' &&
          existing.values &&
          typeof existing.values === 'object' &&
          !Array.isArray(existing.values)
        ) {
          merged = {
            ...payload,
            values: { ...(existing.values as Record<string, unknown>), ...payload.values },
          };
        }
      } catch {
        /* unreadable existing draft → replace */
      }
    }
    window.sessionStorage.setItem(key, JSON.stringify(merged));
    return true;
  } catch {
    return false;
  }
}

/** Route of the full create form for a module. */
export function fullCreateFormHref(moduleKey: string): string {
  return `/crm/modules/${moduleKey}/new`;
}
