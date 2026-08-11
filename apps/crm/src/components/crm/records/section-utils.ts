/**
 * Shared section utilities — safe for both server and client components.
 */

import type {
  CrmField,
  CrmLayout,
  FieldCarrierType,
  LayoutSection,
  LayoutConfig,
  LayoutSectionAccent,
  LayoutSectionVariant,
} from '@/lib/crm/types';

/**
 * Fields that must not render inside record forms / drawers.
 * `notes_history` is legacy Zoho HTML — detail views use LegacyNotesCard / the
 * Notes tab (`crm_notes`) instead. Keeping it in the form leaves an empty
 * "Notes History" section that previously showed a false coverage-parity error.
 */
export const RECORD_FORM_EXCLUDED_FIELD_KEYS = ['notes_history'] as const;

export function isRecordFormExcludedField(fieldKey: string): boolean {
  return (RECORD_FORM_EXCLUDED_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

// ---------------------------------------------------------------------------
// Carrier / Ministry terminology helper
// ---------------------------------------------------------------------------

export interface CarrierTerms {
  /** e.g. "Carrier" or "Ministry" */
  singular: string;
  /** e.g. "Carriers" or "Ministries" */
  plural: string;
  /** Lowercase singular, e.g. "carrier" or "ministry" */
  singularLower: string;
  /** Lowercase plural, e.g. "carriers" or "ministries" */
  pluralLower: string;
}

/**
 * Return the correct user-facing noun for a given carrier type.
 *
 * - `healthshare` → **Ministry / Ministries** (health sharing organizations
 *   like Sedera, Zion, MPB are ministries, not carriers)
 * - everything else → **Carrier / Carriers**
 */
export function getCarrierTerms(carrierType?: FieldCarrierType | string | null): CarrierTerms {
  if (carrierType === 'healthshare') {
    return {
      singular: 'Ministry',
      plural: 'Ministries',
      singularLower: 'ministry',
      pluralLower: 'ministries',
    };
  }
  return {
    singular: 'Carrier',
    plural: 'Carriers',
    singularLower: 'carrier',
    pluralLower: 'carriers',
  };
}

/** Fired when the user taps an Overview section pill; accordion expands before scroll targets `#section-{key}`. */
export const CRM_SECTION_NAV_EVENT = 'crm-record-section-navigate' as const;

/**
 * Canonical top-to-bottom order for person-module record sections. Matches the
 * product layout (Name → Notes → coverage → address → admin) so nav pills and
 * on-page cards stay in sync regardless of DB layout JSON order or field seed
 * insertion order.
 */
export const PERSON_SECTION_DISPLAY_ORDER: readonly string[] = [
  'core',
  'main',
  'personal',
  'contact',
  'notes_history',
  'notes',
  'start_date',
  'health_sharing',
  'insurance',
  'coverage',
  'insurance_coverage',
  'health_insurance',
  'dental_coverage',
  'vision_coverage',
  'other_coverage',
  'life_coverage',
  'product',
  'family_spouse',
  'family_children',
  'family',
  'relationships',
  'address',
  'advisor',
  'management',
  'payment',
  'identifiers',
  'portal',
  'compliance',
  'fulfillment',
  'business',
  'preferences',
  'additional',
  'activity',
  'commissions',
  'conversion',
  'zoho_system',
  'system',
];

/** Deal / pipeline modules — amount & stage before notes. */
export const DEAL_SECTION_DISPLAY_ORDER: readonly string[] = [
  'core',
  'main',
  'deal',
  'amounts',
  'pipeline',
  'stage',
  'products',
  'contacts',
  'notes_history',
  'notes',
  'management',
  'address',
  'activity',
  'system',
];

/** Account / company records. */
export const ACCOUNT_SECTION_DISPLAY_ORDER: readonly string[] = [
  'core',
  'main',
  'business',
  'address',
  'contacts',
  'deals',
  'notes_history',
  'notes',
  'management',
  'payment',
  'activity',
  'system',
];

/** Generic fallback for tickets, providers, custom modules. */
export const DEFAULT_SECTION_DISPLAY_ORDER: readonly string[] = [
  'core',
  'main',
  'notes_history',
  'notes',
  'address',
  'management',
  'payment',
  'activity',
  'additional',
  'system',
  'zoho_system',
];

const MODULE_SECTION_ORDERS: Record<string, readonly string[]> = {
  contacts: PERSON_SECTION_DISPLAY_ORDER,
  leads: PERSON_SECTION_DISPLAY_ORDER,
  members: PERSON_SECTION_DISPLAY_ORDER,
  deals: DEAL_SECTION_DISPLAY_ORDER,
  accounts: ACCOUNT_SECTION_DISPLAY_ORDER,
};

/** Visual grouping for section nav — mirrors Zoho's logical field bands. */
export type SectionNavGroup = 'identity' | 'notes' | 'coverage' | 'location' | 'admin' | 'other';

const SECTION_NAV_GROUP_LABELS: Record<SectionNavGroup, string> = {
  identity: 'Profile',
  notes: 'Notes',
  coverage: 'Coverage',
  location: 'Location',
  admin: 'Admin',
  other: 'More',
};

export function getSectionDisplayOrder(moduleKey?: string | null): readonly string[] {
  if (moduleKey && MODULE_SECTION_ORDERS[moduleKey]) {
    return MODULE_SECTION_ORDERS[moduleKey];
  }
  return DEFAULT_SECTION_DISPLAY_ORDER;
}

export function getSectionNavGroup(sectionKey: string): SectionNavGroup {
  if (['core', 'main', 'personal', 'contact', 'start_date'].includes(sectionKey)) {
    return 'identity';
  }
  if (['notes_history', 'notes'].includes(sectionKey)) return 'notes';
  if (
    isPersonCoverageSectionKey(sectionKey) ||
    [
      'coverage',
      'product',
      'conversion',
      'deal',
      'amounts',
      'pipeline',
      'stage',
      'products',
    ].includes(sectionKey)
  ) {
    return 'coverage';
  }
  if (
    ['address', 'family', 'family_spouse', 'family_children', 'relationships', 'contacts', 'deals'].includes(
      sectionKey,
    )
  ) {
    return 'location';
  }
  if (
    [
      'advisor',
      'management',
      'payment',
      'identifiers',
      'portal',
      'compliance',
      'fulfillment',
      'business',
      'preferences',
      'additional',
      'activity',
      'commissions',
      'zoho_system',
      'system',
    ].includes(sectionKey)
  ) {
    return 'admin';
  }
  return 'other';
}

export function getSectionNavGroupLabel(group: SectionNavGroup): string {
  return SECTION_NAV_GROUP_LABELS[group];
}

/**
 * Semantic accent for each section key — coverage types get distinct hues,
 * identity/notes/address/admin groups stay consistent. Overrides stale or
 * missing layout JSON accents so pills and cards always match.
 */
export const SECTION_ACCENT_BY_KEY: Partial<Record<string, LayoutSectionAccent>> = {
  core: 'blue',
  main: 'blue',
  personal: 'blue',
  contact: 'blue',
  notes_history: 'sky',
  notes: 'sky',
  start_date: 'indigo',
  health_sharing: 'emerald',
  insurance: 'teal',
  coverage: 'teal',
  insurance_coverage: 'blue',
  health_insurance: 'blue',
  dental_coverage: 'cyan',
  vision_coverage: 'purple',
  other_coverage: 'amber',
  life_coverage: 'rose',
  family: 'pink',
  family_spouse: 'pink',
  family_children: 'pink',
  relationships: 'pink',
  address: 'teal',
  advisor: 'violet',
  management: 'violet',
  payment: 'lime',
  identifiers: 'slate',
  portal: 'fuchsia',
  compliance: 'orange',
  fulfillment: 'amber',
  business: 'slate',
  preferences: 'sky',
  additional: 'slate',
  activity: 'violet',
  commissions: 'lime',
  product: 'blue',
  conversion: 'emerald',
  zoho_system: 'slate',
  system: 'slate',
  deal: 'violet',
  amounts: 'lime',
  pipeline: 'indigo',
  stage: 'purple',
  products: 'blue',
  contacts: 'teal',
};

/** Sort section keys: canonical order first, then alphabetical for unknowns. */
export function compareSectionOrder(
  a: string,
  b: string,
  moduleKey?: string | null,
): number {
  const order = getSectionDisplayOrder(moduleKey);
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
  const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
  if (aRank !== bRank) return aRank - bRank;
  return a.localeCompare(b);
}

/** Resolve the accent shown in nav pills and section cards. */
export function resolveSectionAccent(
  sectionKey: string,
  layoutAccent?: LayoutSectionAccent,
): LayoutSectionAccent {
  return SECTION_ACCENT_BY_KEY[sectionKey] ?? layoutAccent ?? 'slate';
}

/**
 * Merge layout sections with field-only extras, normalize labels, apply semantic
 * accents, and sort into canonical display order.
 */
export function buildEffectiveSections(
  layoutConfig: LayoutConfig | undefined | null,
  fieldSectionKeys: Iterable<string>,
  moduleKey?: string | null,
): LayoutSection[] {
  const layoutSections = layoutConfig?.sections ?? [{ key: 'main', label: 'General', columns: 2 as const }];
  const coveredKeys = new Set(layoutSections.map((s) => s.key));

  const extraSections: LayoutSection[] = [];
  for (const sectionKey of fieldSectionKeys) {
    if (!coveredKeys.has(sectionKey)) {
      extraSections.push({
        key: sectionKey,
        label: fallbackSectionHeadingFromFieldSection(sectionKey),
        columns: 2,
      });
    }
  }

  return [...layoutSections, ...extraSections]
    .map((s) => ({
      ...s,
      label: normalizeLegacySectionHeading(s.key, s.label),
      accent: resolveSectionAccent(s.key, s.accent),
    }))
    .sort((a, b) => compareSectionOrder(a.key, b.key, moduleKey));
}

export interface SectionMeta {
  key: string;
  label: string;
  /** Total fields configured in this section. */
  fieldCount: number;
  /**
   * Fields with a non-empty value on the current record. When `recordData`
   * isn't supplied this falls back to `fieldCount` so callers without record
   * context still render a number. The pill in the section nav prefers this
   * because reps care about what's actually filled in, not what's possible.
   */
  filledCount: number;
  /**
   * When set, the nav pill shows this number instead of {@link filledCount}.
   * The notes group uses it so the pill mirrors the real note-record count
   * (the sidebar related list's source of truth) rather than form-field fill
   * state — otherwise a "Notes History" section with an empty legacy textarea
   * reads "0" next to a sidebar "Notes 6" and looks broken to clients.
   */
  badgeCount?: number;
  /**
   * Optional non-scroll click behavior for the nav pill. `'open-notes'`
   * switches the record shell to the Notes related list instead of scrolling
   * to the (legacy, often-empty) `notes_history` field section, so the pill
   * and sidebar point at the same data.
   */
  navAction?: 'open-notes';
  accent?: LayoutSectionAccent;
  variant?: LayoutSectionVariant;
  navGroup: SectionNavGroup;
}

export interface SectionMetaOptions {
  /** When true, nav includes empty editable sections (matches inline overview). */
  inlineEditable?: boolean;
  /**
   * Real note-record count (crm_notes + parsed legacy `notes_history` entries)
   * for this record. When provided, the notes-group nav pill mirrors this
   * number and links to the Notes related list so it agrees with the sidebar
   * instead of showing a confusing field-fill count.
   */
  noteCount?: number;
}

/** Whether a section should appear in nav + on-page stack for this record. */
export function shouldIncludeSectionInNav(
  section: LayoutSection,
  sectionFields: CrmField[],
  recordData: Record<string, unknown> | null | undefined,
  moduleKey: string | undefined | null,
  inlineEditable: boolean,
  options?: { noteCount?: number; notesAnchored?: boolean },
): boolean {
  if (section.variant === 'hero') return true;
  if (shouldAlwaysShowEmptySection(moduleKey, section.key, inlineEditable)) return true;
  // Notes pill stays when the page knows a real note total (crm_notes + legacy),
  // or when a legacy notes_history field anchors the section (form-excluded).
  if (
    getSectionNavGroup(section.key) === 'notes' &&
    (typeof options?.noteCount === 'number' || options?.notesAnchored)
  ) {
    return true;
  }
  if (sectionFields.length === 0) return false;
  if (inlineEditable) return true;
  if (!recordData) return sectionFields.length > 0;
  return sectionFields.some((f) => isPopulated(recordData[f.key]));
}

/**
 * Legacy slug `insurance` (Zoho/import era) carries HealthShare-centric product/carrier/start rows
 * for PIF deployments. Labels like "Insurance" are misleading compared to newer `insurance_coverage`
 * wording — prefer HealthShare when the layout uses a generic insurance title so nav + overview match.
 *
 * Leaves custom titles alone (anything that doesn't start with "Insurance", case-insensitive).
 */
export function normalizeLegacySectionHeading(key: string, label: string): string {
  if (key !== 'insurance') return label;
  const t = label.trim();
  if (t === '') return 'HealthShare';
  if (/^insurance\b/i.test(t)) return 'HealthShare';
  return label;
}

function titleCaseSectionKey(sectionKey: string): string {
  return sectionKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Modules where reps enter / edit coverage after lead conversion. */
export const PERSON_MODULE_KEYS = ['contacts', 'leads', 'members'] as const;

/**
 * Sections that must stay visible (and editable) even when every field is blank.
 * Without this, read-only detail views collapse empty cards to 1px anchors and
 * reps cannot add insurance / HealthShare data on freshly converted contacts.
 */
export const PERSON_COVERAGE_SECTION_KEYS = [
  'health_sharing',
  'health_insurance',
  'insurance',
  'insurance_coverage',
  'dental_coverage',
  'vision_coverage',
  'other_coverage',
  'life_coverage',
  'product',
] as const;

export function isPersonModuleKey(moduleKey?: string | null): boolean {
  if (!moduleKey) return false;
  return (PERSON_MODULE_KEYS as readonly string[]).includes(moduleKey);
}

export function isPersonCoverageSectionKey(sectionKey: string): boolean {
  return (PERSON_COVERAGE_SECTION_KEYS as readonly string[]).includes(sectionKey);
}

/**
 * Whether a section with zero configured fields should still render on the
 * record detail view.
 *
 * Only person-module coverage sections force-show when empty — reps need those
 * cards (with the parity prompt) right after lead → contact conversion.
 *
 * `inlineEditable` is accepted for call-site symmetry but does **not** force
 * orphan layout sections (e.g. a leftover `start_date` band with no fields, or
 * `notes_history` after the legacy textarea is excluded from the form). Sections
 * that *have* fields but blank values stay visible via
 * {@link shouldIncludeSectionInNav}'s `inlineEditable` branch instead.
 */
export function shouldAlwaysShowEmptySection(
  moduleKey: string | undefined | null,
  sectionKey: string,
  _inlineEditable: boolean,
): boolean {
  return isPersonModuleKey(moduleKey) && isPersonCoverageSectionKey(sectionKey);
}

/** Default heading for extra sections inferred only from {@link CrmField.section}. */
export function fallbackSectionHeadingFromFieldSection(sectionKey: string): string {
  // Legacy Zoho `insurance` holds product / premium / date rows — not the same as `health_sharing`.
  if (sectionKey === 'insurance') return 'Membership & Product';
  if (sectionKey === 'health_sharing') return 'HealthShare';
  return titleCaseSectionKey(sectionKey);
}

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

/**
 * Identity contact channels that often live in `core` while the Contact section
 * only defines sparse extras (e.g. `mobile_2`). Credit these toward the Contact
 * pill so "Contact: 0" never appears when the header already shows email/phone.
 */
export const CONTACT_SECTION_IDENTITY_KEYS = [
  'email',
  'phone',
  'mobile',
  'secondary_email',
  'work_phone',
] as const;

function contactSectionIdentityFill(
  recordData: Record<string, unknown> | null | undefined,
  sectionFieldKeys: Set<string>,
): { extraFilled: number; extraFields: number } {
  if (!recordData) return { extraFilled: 0, extraFields: 0 };
  let extraFilled = 0;
  let extraFields = 0;
  for (const key of CONTACT_SECTION_IDENTITY_KEYS) {
    if (sectionFieldKeys.has(key)) continue;
    extraFields += 1;
    if (isPopulated(recordData[key])) extraFilled += 1;
  }
  return { extraFilled, extraFields };
}

/**
 * Compute section metadata from fields + layout.
 * Returns the list of sections with field counts, filtering out empty ones.
 *
 * `recordData` is the merged form-defaults map (JSONB `data` overlaid with
 * indexed columns) — when supplied, each section reports the count of fields
 * whose value is actually populated. Reps see "(3)" instead of "(26)" so the
 * number reflects what's filled in, not what's possible.
 */
export function getSectionMeta(
  fields: CrmField[],
  layout?: CrmLayout | null,
  recordData?: Record<string, unknown> | null,
  moduleKey?: string | null,
  options?: SectionMetaOptions,
): SectionMeta[] {
  const inlineEditable = options?.inlineEditable ?? false;
  const noteCount = options?.noteCount;
  const layoutConfig: LayoutConfig = layout?.config || { sections: [{ key: 'main', label: 'Information', columns: 2 }] };

  // Group form-visible fields for counts. Keep notes-section anchors when the
  // only field is the excluded legacy notes_history textarea so the Notes pill
  // still appears (with open-notes / noteCount badge).
  const grouped: Record<string, CrmField[]> = {};
  const sectionKeys = new Set<string>();
  const notesAnchors = new Set<string>();
  for (const field of fields) {
    const section = field.section || 'main';
    sectionKeys.add(section);
    if (isRecordFormExcludedField(field.key)) {
      if (getSectionNavGroup(section) === 'notes') notesAnchors.add(section);
      continue;
    }
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(field);
  }
  for (const key of sectionKeys) {
    if (!grouped[key]) grouped[key] = [];
  }

  const allSections = buildEffectiveSections(layoutConfig, sectionKeys, moduleKey);

  return allSections
    .filter((s) =>
      shouldIncludeSectionInNav(
        s,
        grouped[s.key] ?? [],
        recordData,
        moduleKey,
        inlineEditable,
        { noteCount, notesAnchored: notesAnchors.has(s.key) },
      ),
    )
    .map((s) => {
      const sectionFields = grouped[s.key] ?? [];
      let fieldCount = sectionFields.length;
      let filledCount = recordData
        ? sectionFields.filter((f) => isPopulated(recordData[f.key])).length
        : fieldCount;
      // Contact pill honesty: email/phone usually live in `core` ("Name"), so the
      // Contact section would otherwise show "0 of 1" on long-time members.
      if (s.key === 'contact' && isPersonModuleKey(moduleKey)) {
        const { extraFilled, extraFields } = contactSectionIdentityFill(
          recordData,
          new Set(sectionFields.map((f) => f.key)),
        );
        fieldCount += extraFields;
        if (recordData) filledCount += extraFilled;
        else filledCount = fieldCount;
      }
      const navGroup = getSectionNavGroup(s.key);
      // Notes-group pills always open the Notes tab (canonical crm_notes +
      // legacy history). When noteCount is provided, the badge mirrors that
      // total so the pill never disagrees with the tab/sidebar.
      const isNotesGroup = navGroup === 'notes';
      const syncsNoteCount = isNotesGroup && typeof noteCount === 'number';
      return {
        key: s.key,
        // Notes pills read "Notes" to match the sidebar related list; the
        // on-page section card keeps its own heading (rendered separately in
        // DynamicRecordForm, so this relabel doesn't touch the form).
        label: syncsNoteCount ? 'Notes' : normalizeLegacySectionHeading(s.key, s.label),
        fieldCount,
        filledCount,
        badgeCount: syncsNoteCount ? noteCount : undefined,
        navAction: isNotesGroup ? ('open-notes' as const) : undefined,
        accent: resolveSectionAccent(s.key, s.accent),
        variant: s.variant,
        navGroup,
      };
    });
}
