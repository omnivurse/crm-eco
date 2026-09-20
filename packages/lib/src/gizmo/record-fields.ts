import type { GizmoRecordHit, RecordAsk } from './types';

interface FieldAliasSpec {
  key: string;
  label: string;
  aliases: string[];
}

/**
 * Spoken phrases → canonical record keys. Longest alias wins so
 * "member number" beats "number" and "email address" beats "address".
 */
export const GIZMO_FIELD_SPECS: readonly FieldAliasSpec[] = [
  {
    key: 'phone',
    label: 'phone',
    aliases: [
      'phone number',
      'telephone number',
      'mobile number',
      'cell phone',
      'cellphone',
      'work phone',
      'home phone',
      'mobile phone',
      'telephone',
      'mobile',
      'phone',
      'cell',
    ],
  },
  {
    key: 'email',
    label: 'email',
    aliases: ['email address', 'e-mail address', 'e-mail', 'emails', 'email', 'mail'],
  },
  {
    key: 'address',
    label: 'address',
    aliases: ['mailing address', 'street address', 'home address', 'full address', 'address'],
  },
  {
    key: 'city',
    label: 'city',
    aliases: ['mailing city', 'city'],
  },
  {
    key: 'state',
    label: 'state',
    aliases: ['mailing state', 'state'],
  },
  {
    key: 'zip',
    label: 'zip',
    aliases: ['zip code', 'zipcode', 'mailing zip', 'postal code', 'zip'],
  },
  {
    key: 'member_number',
    label: 'member number',
    aliases: [
      'membership number',
      'member number',
      'member no',
      'member #',
      'member id',
      'membership #',
    ],
  },
  {
    key: 'sharing_member_id',
    label: 'sharing member id',
    aliases: ['sharing member id', 'sharing id'],
  },
  {
    key: 'e123_member_id',
    label: 'E123 member id',
    aliases: ['e123 member id', 'e123'],
  },
  {
    key: 'enrollment_number',
    label: 'enrollment number',
    aliases: ['enrollment number', 'application number', 'enrollment #', 'app number'],
  },
  {
    key: 'status',
    label: 'status',
    aliases: ['lead status', 'contact status', 'member status', 'status'],
  },
  {
    key: 'stage',
    label: 'stage',
    aliases: ['pipeline stage', 'stage'],
  },
  {
    key: 'company',
    label: 'company',
    aliases: ['company name', 'employer', 'account name', 'company'],
  },
  {
    key: 'first_name',
    label: 'first name',
    aliases: ['first name', 'given name'],
  },
  {
    key: 'last_name',
    label: 'last name',
    aliases: ['last name', 'surname', 'family name'],
  },
  {
    key: 'dob',
    label: 'date of birth',
    aliases: ['date of birth', 'birth date', 'birthday', 'birthdate', 'dob'],
  },
  {
    key: 'advisor_name',
    label: 'advisor',
    aliases: ['advisor name', 'producer name', 'agent name', 'advisor', 'producer'],
  },
  {
    key: 'plan_name',
    label: 'plan',
    aliases: ['plan name', 'product name', 'plan', 'product'],
  },
  {
    key: 'carrier',
    label: 'carrier',
    aliases: ['sharing entity', 'carrier'],
  },
  {
    key: 'iua_amount',
    label: 'IUA',
    aliases: ['iua amount', 'iua'],
  },
];

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

function aliasPattern(alias: string): RegExp {
  const escaped = alias.replace(ESCAPE_RE, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

const SORTED_ALIASES = GIZMO_FIELD_SPECS.flatMap((spec) =>
  spec.aliases.map((alias) => ({
    alias,
    key: spec.key,
    label: spec.label,
    pattern: aliasPattern(alias),
    len: alias.length,
  })),
).sort((a, b) => b.len - a.len || a.alias.localeCompare(b.alias));

export const FIELD_ALIAS_WORDS = new Set(
  GIZMO_FIELD_SPECS.flatMap((spec) => spec.aliases.flatMap((alias) => alias.toLowerCase().split(/\s+/))),
);

export function matchRecordAsk(query: string): RecordAsk | null {
  const q = query.trim();
  if (!q) return null;

  let best: { key: string; label: string; len: number } | null = null;
  for (const row of SORTED_ALIASES) {
    if (!row.pattern.test(q)) continue;
    if (!best || row.len > best.len) best = { key: row.key, label: row.label, len: row.len };
  }

  if (best) return { key: best.key, label: best.label };

  if (
    /\bnumbers?\b/i.test(q) &&
    !/\bmember(?:ship)?\s*(#|number|no\.?)/i.test(q) &&
    (/\b[\p{L}][\p{L}.-]*['’]s\b/u.test(q) || /\bnumber\s+for\b/i.test(q) || /\bfor\b.+\bnumber\b/i.test(q))
  ) {
    return { key: 'phone', label: 'phone' };
  }
  return null;
}

function stringifyField(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

const PHONE_KEYS = [
  'phone',
  'mobile',
  'work_phone',
  'home_phone',
  'cell',
  'mobile_phone',
  'cell_phone',
  'phone_number',
  'phone2',
];
const EMAIL_KEYS = ['email', 'email2', 'secondary_email'];
const ADDRESS_LINE_KEYS = ['address_line1', 'mailing_street', 'street', 'address'];
const CITY_KEYS = ['city', 'mailing_city'];
const STATE_KEYS = ['state', 'mailing_state'];
const ZIP_KEYS = ['zip', 'zip_code', 'mailing_zip'];
const DOB_KEYS = ['dob', 'date_of_birth', 'birthdate', 'birthday'];
const COMPANY_KEYS = ['company', 'company_name'];
const PLAN_KEYS = ['plan_name', 'product', 'plan'];
const ADVISOR_KEYS = ['advisor_name', 'producer_name', 'advisor'];

function firstField(fields: Record<string, string> | undefined, keys: string[]): string | undefined {
  if (!fields) return undefined;
  for (const key of keys) {
    const value = fields[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function composeAddress(fields: Record<string, string> | undefined): string | undefined {
  if (!fields) return undefined;
  const line = firstField(fields, ADDRESS_LINE_KEYS);
  const city = firstField(fields, CITY_KEYS);
  const state = firstField(fields, STATE_KEYS);
  const zip = firstField(fields, ZIP_KEYS);
  const parts = [line, [city, state].filter(Boolean).join(', '), zip].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/** Flatten column + JSONB values a Gizmo reply can speak. */
export function speakableFields(input: {
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  title?: string | null;
  data?: Record<string, unknown> | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  const take = (key: string, value: unknown) => {
    const text = stringifyField(value);
    if (text) out[key] = text;
  };
  take('email', input.email);
  take('phone', input.phone);
  take('status', input.status);
  take('title', input.title);
  const data = input.data;
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      take(key, value);
    }
  }
  return out;
}

export function resolveAskedValue(hit: GizmoRecordHit, ask: RecordAsk | null): string | undefined {
  if (!ask) return undefined;
  const fields = hit.fields;
  switch (ask.key) {
    case 'phone':
      return hit.phone?.trim() || firstField(fields, PHONE_KEYS);
    case 'email':
      return hit.email?.trim() || firstField(fields, EMAIL_KEYS);
    case 'address':
      return composeAddress(fields);
    case 'city':
      return firstField(fields, CITY_KEYS);
    case 'state':
      return firstField(fields, STATE_KEYS);
    case 'zip':
      return firstField(fields, ZIP_KEYS);
    case 'dob':
      return firstField(fields, DOB_KEYS);
    case 'company':
      return firstField(fields, COMPANY_KEYS);
    case 'plan_name':
      return firstField(fields, PLAN_KEYS);
    case 'advisor_name':
      return firstField(fields, ADVISOR_KEYS);
    default:
      return fields?.[ask.key]?.trim() || undefined;
  }
}
