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
 *
 * Validation lives here too (`validateQuickCreate`): required fields, date
 * completeness + calendar validity, and the Pending start-date rule — so the
 * drawer never POSTs an invalid or partial date and every message is anchored
 * to a field (Road to Ten DE-5 / DE-6).
 */

import { isPendingContactStatus } from '@/lib/crm/pending-activation';
import { maskDateTyping } from '@/lib/crm/date-field-bounds';
import { isValidCalendarDateParts } from '@/lib/crm/merge-crm-data-json-to-row';

export type QuickCreateModuleKey = 'contacts' | 'leads' | 'accounts';

export const QUICK_CREATE_MODULE_KEYS: readonly QuickCreateModuleKey[] = [
  'contacts',
  'leads',
  'accounts',
] as const;

/**
 * - `state`    → native <select> of US states + DC (lib/crm/us-states); an
 *                existing value that is not a known code stays selectable.
 * - `select`   → closed list from the live `crm_fields.options` for the key
 *                (`fallbackOptions` until they load). With `allowOther` the
 *                list ends in an explicit "Other…" row that reveals a text
 *                input (owner decision D3 — Health Sharing Membership); a
 *                value that is not in the list (legacy spelling carried over
 *                by "Save & add another") stays selectable, never rewritten.
 * - `suggest`  → text input with a suggestion list: the org's distinct stored
 *                values for the key (GET /api/crm/records/field-values, DE-2),
 *                values used earlier this session and any crm_fields options.
 *                Free text is always allowed; the list only speeds typing
 *                (decision D4 — Health Insurance Plan).
 * - `producer` → "Enrolled by" picker over the org's producers
 *                (public.advisors via GET /api/crm/advisors). Picking a row
 *                writes the display name into this key AND the advisor id
 *                into `producer_record_id` (decision D5); "Not in list — add
 *                as typed" keeps free text with no id.
 */
export type QuickCreateFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'date'
  | 'select'
  | 'state'
  | 'suggest'
  | 'producer';

/**
 * JSONB key that carries the picked producer's `public.advisors.id` next to
 * the display-name key (`producer_name` on contacts, `producer` on leads).
 * The name stays THE written key — reports, the age-65 cron and
 * ownership-name precedence keep reading it; the id is additive.
 */
export const PRODUCER_RECORD_ID_KEY = 'producer_record_id';

/** The one sentence for "Pending without a start date" — render-time hint, submit error and the server-code mapping all use it. */
export const QUICK_CREATE_PENDING_NEEDS_DATE = 'Pending needs a Coverage start date';
/** Copy for a date that is incomplete or not a real calendar date. */
export const QUICK_CREATE_INVALID_DATE = 'Enter a real date as MM/DD/YYYY';

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
  /** Selects only: append an explicit "Other…" row that reveals a free-text input. */
  allowOther?: boolean;
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
  /** Which JSONB key is the coverage effective/start date (legacy single-key). */
  effectiveDateKey?: string;
  /** Insurance start and/or sharing start — Pending is satisfied if any is filled. */
  effectiveDateKeys?: string[];
  /**
   * Keys that stay filled after "Save & add another" — the batch-entry
   * fields that repeat across a stack of enrollments from the same producer /
   * sharing entity / state. Everything else resets to `initialQuickCreateValues`.
   */
  batchStickyKeys?: string[];
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
    effectiveDateKeys: ['health_insurance_start_date', 'sharing_effective_date'],
    batchStickyKeys: ['producer_name', PRODUCER_RECORD_ID_KEY, 'sharing_entity', 'contact_status', 'mailing_state'],
    fields: [
      { key: 'first_name', label: 'First name', type: 'text', required: true },
      { key: 'last_name', label: 'Last name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'tel', placeholder: '555-555-5555' },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'Optional' },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'mailing_city', label: 'City', type: 'text' },
      { key: 'mailing_state', label: 'State', type: 'state', placeholder: 'e.g. TX' },
      { key: 'health_insurance_plan_name', label: 'Health Insurance Plan', type: 'suggest' },
      { key: 'health_insurance_start_date', label: 'Coverage start', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'product', label: 'Health Sharing Membership', type: 'select', allowOther: true },
      { key: 'sharing_effective_date', label: 'Sharing effective date', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'producer_name', label: 'Enrolled by', hint: 'Who enrolled', type: 'producer' },
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
    effectiveDateKeys: ['health_insurance_start_date', 'sharing_effective_date'],
    batchStickyKeys: ['producer', PRODUCER_RECORD_ID_KEY, 'sharing_entity', 'lead_status', 'state'],
    fields: [
      { key: 'first_name', label: 'First name', type: 'text', required: true },
      { key: 'last_name', label: 'Last name', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'tel', placeholder: '555-555-5555' },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'Optional' },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'state', placeholder: 'e.g. TX' },
      { key: 'health_insurance_plan_name', label: 'Health Insurance Plan', type: 'suggest' },
      { key: 'health_insurance_start_date', label: 'Coverage start', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'product_type', label: 'Health Sharing Membership', type: 'select', allowOther: true },
      { key: 'sharing_effective_date', label: 'Sharing effective date', type: 'date', placeholder: 'MM/DD/YYYY' },
      { key: 'producer', label: 'Enrolled by', hint: 'Who enrolled', type: 'producer' },
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

/**
 * True when the user has typed anything beyond the baseline (select defaults,
 * or — after "Save & add another" — defaults + the sticky batch fields, so a
 * carried-over producer does not by itself trigger the discard prompt).
 */
export function isQuickCreateDirty(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
  baseline: Record<string, string> = initialQuickCreateValues(moduleKey),
): boolean {
  return Object.entries(values).some(([k, v]) => (v ?? '').trim() !== '' && (baseline[k] ?? '') !== v);
}

/**
 * Values to start the NEXT record from after "Save & add another": select
 * defaults, with the module's `batchStickyKeys` carried over from the record
 * just saved (only when they were actually filled).
 */
export function nextQuickCreateBatchValues(
  moduleKey: QuickCreateModuleKey,
  previous: Record<string, string>,
): Record<string, string> {
  const out = initialQuickCreateValues(moduleKey);
  for (const key of QUICK_CREATE_FIELDS[moduleKey].batchStickyKeys ?? []) {
    const v = (previous[key] ?? '').trim();
    if (v) out[key] = previous[key];
  }
  return out;
}

/** Keys whose values are worth remembering as suggestions this session (`suggest` fields). */
export function quickCreateSuggestKeys(moduleKey: QuickCreateModuleKey): string[] {
  return QUICK_CREATE_FIELDS[moduleKey].fields.filter((f) => f.type === 'suggest').map((f) => f.key);
}

/** The module's "Enrolled by" field (display-name key), if it has one. */
export function quickCreateProducerField(moduleKey: QuickCreateModuleKey): QuickCreateField | undefined {
  return QUICK_CREATE_FIELDS[moduleKey].fields.find((f) => f.type === 'producer');
}

// ---------------------------------------------------------------------------
// Duplicate pre-check parity with the server (record-create-service.ts)
// ---------------------------------------------------------------------------

export interface QuickCreateDuplicateCandidate {
  id: string;
  title: string | null;
  email?: string | null;
  phone?: string | null;
}

/** Same normalisation as `normalizeName` in record-create-service: lower, collapse ws, trim. */
export function normalizeDuplicateName(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Comparable "first last" (or title/name fallback) for what the user typed. */
export function quickCreateTypedName(values: Record<string, string>): string {
  const combined = `${values.first_name ?? ''} ${values.last_name ?? ''}`.trim();
  const fallback = values.title || values.name || '';
  return normalizeDuplicateName(combined || fallback);
}

export interface QuickCreateDuplicateSplit<C extends QuickCreateDuplicateCandidate> {
  /** Same contact info AND the same name → the server would 409 → amber card + "Create anyway". */
  blocking: C[];
  /** Same phone/email, DIFFERENT name (family member) → grey hint; create proceeds without force. */
  soft: C[];
}

/**
 * Mirror of the server rule (record-create-service.ts): a check_crm_duplicate
 * candidate only blocks the create when its normalised name equals the typed
 * first+last. When no name is typed yet every candidate is treated as
 * blocking, exactly like the server (`!newName ||` …).
 */
export function splitQuickCreateDuplicates<C extends QuickCreateDuplicateCandidate>(
  values: Record<string, string>,
  candidates: readonly C[],
): QuickCreateDuplicateSplit<C> {
  const typed = quickCreateTypedName(values);
  const blocking: C[] = [];
  const soft: C[] = [];
  for (const c of candidates) {
    if (!typed || normalizeDuplicateName(c.title) === typed) blocking.push(c);
    else soft.push(c);
  }
  return { blocking, soft };
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
 * Insurance coverage start OR sharing effective date both count.
 *
 * Parity with the server rule (pending-start-date-invariant.ts): on LEADS
 * "Pending" is a pipeline stage, not pending coverage — no start date is
 * implied, so a Pending lead saves without one.
 */
export function quickCreatePendingNeedsEffectiveDate(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): boolean {
  if (moduleKey === 'leads') return false;
  const cfg = QUICK_CREATE_FIELDS[moduleKey];
  if (!cfg.statusKey) return false;
  const dateKeys = cfg.effectiveDateKeys ?? (cfg.effectiveDateKey ? [cfg.effectiveDateKey] : []);
  if (dateKeys.length === 0) return false;
  const status = values[cfg.statusKey];
  if (!isPendingContactStatus(status)) return false;
  return !dateKeys.some((key) => (values[key] ?? '').trim());
}

/** Which date key was actually filled (insurance start wins over sharing start). */
export function quickCreateFilledEffectiveDateKey(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): string | undefined {
  const cfg = QUICK_CREATE_FIELDS[moduleKey];
  const dateKeys = cfg.effectiveDateKeys ?? (cfg.effectiveDateKey ? [cfg.effectiveDateKey] : []);
  for (const key of dateKeys) {
    if ((values[key] ?? '').trim()) return key;
  }
  return undefined;
}

/** The field the Pending hint / error is anchored to (first effective-date key: Coverage start). */
export function quickCreatePendingDateKey(moduleKey: QuickCreateModuleKey): string | undefined {
  const cfg = QUICK_CREATE_FIELDS[moduleKey];
  return (cfg.effectiveDateKeys ?? (cfg.effectiveDateKey ? [cfg.effectiveDateKey] : []))[0];
}

/**
 * Render-time hint for the Pending rule: the sentence to show under Coverage
 * start while status is Pending-class and neither date is filled, or null.
 * Same string the submit error and the server-code mapping use.
 */
export function quickCreatePendingHint(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): string | null {
  return quickCreatePendingNeedsEffectiveDate(moduleKey, values) ? QUICK_CREATE_PENDING_NEEDS_DATE : null;
}

/**
 * True when a typed date is complete and a real calendar date once masked
 * to MM/DD/YYYY (the same mask the payload applies). Blank counts as valid —
 * emptiness is the required-field rule's job.
 *
 *   '9/1/26'     → true  (masks to 09/01/2026)
 *   '2026-09-01' → true  (stored ISO, masks to 09/01/2026)
 *   '09/01'      → false (incomplete)
 *   '13/45/2026' → false (no 13th month)
 *   '02/30/2026' → false (not a real day)
 */
export function isValidQuickCreateDate(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return true;
  const masked = maskDateTyping(t);
  const m = masked.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const year = Number(m[3]);
  if (year < 1900 || year > 2100) return false;
  return isValidCalendarDateParts(year, Number(m[1]), Number(m[2]));
}

/** Date fields whose typed value is incomplete or impossible, in field order. */
export function invalidQuickCreateDates(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): { key: string; label: string }[] {
  return QUICK_CREATE_FIELDS[moduleKey].fields
    .filter((f) => f.type === 'date' && !isValidQuickCreateDate(values[f.key]))
    .map((f) => ({ key: f.key, label: f.label }));
}

export interface QuickCreateFieldError {
  /** `crm_fields.key` the message is anchored to. */
  key: string;
  label: string;
  message: string;
}

/** "First name is required" — one voice for blank required fields. */
export function quickCreateRequiredMessage(label: string): string {
  return `${label} is required`;
}

/**
 * Everything that must be fixed BEFORE the POST, anchored to a field and in
 * field order (the first entry is the one to focus): blank required fields,
 * incomplete / impossible dates, and the Pending start-date rule (anchored to
 * Coverage start). Empty array ⇒ safe to submit. Never returns two messages
 * for one key (the first rule wins).
 */
export function validateQuickCreate(
  moduleKey: QuickCreateModuleKey,
  values: Record<string, string>,
): QuickCreateFieldError[] {
  const byKey = new Map<string, QuickCreateFieldError>();
  const add = (key: string, label: string, message: string) => {
    if (!byKey.has(key)) byKey.set(key, { key, label, message });
  };
  const cfg = QUICK_CREATE_FIELDS[moduleKey];
  for (const f of cfg.fields) {
    if (f.required && !(values[f.key] ?? '').trim()) add(f.key, f.label, quickCreateRequiredMessage(f.label));
  }
  for (const d of invalidQuickCreateDates(moduleKey, values)) add(d.key, d.label, QUICK_CREATE_INVALID_DATE);
  const pendingKey = quickCreatePendingDateKey(moduleKey);
  if (pendingKey && quickCreatePendingNeedsEffectiveDate(moduleKey, values)) {
    const label = cfg.fields.find((f) => f.key === pendingKey)?.label ?? pendingKey;
    add(pendingKey, label, QUICK_CREATE_PENDING_NEEDS_DATE);
  }
  // field order
  const order = new Map(cfg.fields.map((f, i) => [f.key, i]));
  return [...byKey.values()].sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
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
  // The picked producer's id rides along with the name (D5) — only when a
  // name is actually written, so a stale id never outlives a cleared name.
  const producer = quickCreateProducerField(moduleKey);
  const producerId = (values[PRODUCER_RECORD_ID_KEY] ?? '').trim();
  if (producer && producerId && out[producer.key]) out[PRODUCER_RECORD_ID_KEY] = producerId;
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
