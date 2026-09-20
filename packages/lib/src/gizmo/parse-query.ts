import { looksLikeHowtoQuery, looksLikePlaceQuery, normalizeQuery, tokenize } from './match';
import { GIZMO_FIELD_SPECS, matchRecordAsk } from './record-fields';
import type { RecordAskField } from './types';

export interface ParsedRecordQuery {
  shouldSearch: boolean;
  isPersonLookup: boolean;
  searchTerm: string;
  askedField: RecordAskField;
}

const FIND_HINT =
  /\b(find|search|open|lookup|look up|look at|who is|show me|get me|pull up|bring up)\b/i;
const PHONE_HINT = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/;
const MEMBER_NUM = /(?:#|member(?:ship)?\s*(?:#|number|no\.?)?\s*)\d{3,}/i;
const UUID_HINT = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const EMAIL_HINT = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const POSSESSIVE_NAME = /\b[\p{L}][\p{L}.-]*['’]s\b/u;

const PAGE_WORDS = new Set([
  'reports',
  'report',
  'settings',
  'import',
  'inbox',
  'workqueue',
  'dashboard',
  'contacts',
  'leads',
  'deals',
  'members',
  'calendar',
  'tasks',
  'mfa',
  '2fa',
  'security',
  'billing',
  'commissions',
  'coverage',
  'needs',
  'pipeline',
  'home',
  'learn',
  'help',
  'rates',
]);

const SETTINGS_WORDS = new Set([
  'api',
  'keys',
  'key',
  'assignment',
  'rules',
  'integrations',
  'webhooks',
  'developer',
  'automation',
  'automations',
  'mfa',
  '2fa',
  'security',
  'settings',
  'workflow',
  'workflows',
  'scoring',
  'macros',
]);

const EXTRACT_FILLER = new Set([
  'i',
  'im',
  'i\'m',
  'id',
  'ive',
  'need',
  'needs',
  'needed',
  'please',
  'can',
  'you',
  'me',
  'get',
  'give',
  'show',
  'tell',
  'what',
  'whats',
  'what\'s',
  'the',
  'a',
  'an',
  'my',
  'to',
  'for',
  'of',
  'and',
  'or',
  'his',
  'her',
  'their',
  's',
  'number',
  'numbers',
  'info',
  'information',
  'contact',
  'hey',
  'hi',
  'hello',
  'thanks',
  'thank',
  'just',
  'want',
  'wanna',
  'could',
  'would',
  'should',
  'may',
  'might',
  'does',
  'did',
  'have',
  'has',
  'got',
]);

const FIELD_WORDS = new Set([
  'phone',
  'telephone',
  'mobile',
  'cell',
  'cellphone',
  'email',
  'e-mail',
  'emails',
  'e-mails',
  'mail',
  'address',
  'street',
  'zip',
  'zipcode',
]);

const INTENT_WORDS = new Set([
  'find',
  'search',
  'open',
  'where',
  'who',
  'how',
  'look',
  'lookup',
  'page',
  'go',
  'take',
  'locate',
  'pull',
  'grab',
  'show',
  'bring',
  'get',
]);

const RECORD_TYPE_WORDS = new Set([
  'member',
  'members',
  'contact',
  'contacts',
  'lead',
  'leads',
  'deal',
  'deals',
  'account',
  'accounts',
  'company',
  'companies',
  'record',
  'records',
  'person',
  'people',
  'enrollment',
  'enrollments',
  'advisor',
  'advisors',
  'agent',
  'agents',
  'prospect',
  'prospects',
  'task',
  'tasks',
]);

const EMPTY: ParsedRecordQuery = {
  shouldSearch: false,
  isPersonLookup: false,
  searchTerm: '',
  askedField: null,
};

export function detectAskedField(query: string): RecordAskField {
  return matchRecordAsk(query);
}

function remainderAfterIntent(query: string): string {
  return query
    .replace(
      /^(where'?s|where is|take me to|go to|find the|page for|how do i|how to|how can i|show me|get me|pull up|bring up|find|search for|search|open|look up|look at|lookup|who is)\s+/i,
      '',
    )
    .trim();
}

function isNameish(query: string): boolean {
  const tokens = tokenize(query).filter(
    (t) =>
      !['find', 'search', 'open', 'where', 'is', 'who', 'how', 'do'].includes(t) &&
      !EXTRACT_FILLER.has(t) &&
      !PAGE_WORDS.has(t),
  );
  if (tokens.length >= 2 && tokens.every((t) => /^[a-z][a-z'-]{1,}$/i.test(t))) return true;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(query.trim())) return true;
  return false;
}

function isSearchableTerm(term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  if (isNameish(t)) return true;
  const tokens = tokenize(t);
  if (tokens.length === 1) {
    const only = tokens[0];
    return /^[a-z][a-z'-]{1,}$/i.test(only) && !PAGE_WORDS.has(only) && !SETTINGS_WORDS.has(only);
  }
  return tokens.some((tok) => /^[a-z][a-z'-]{1,}$/i.test(tok) || /^\d/.test(tok));
}

function restIsPageWord(restNorm: string): boolean {
  const parts = restNorm.split(' ').filter(Boolean);
  return parts.length > 0 && parts.every((t) => PAGE_WORDS.has(t));
}

function isSettingsish(query: string): boolean {
  const tokens = tokenize(query);
  return tokens.length > 0 && tokens.every((t) => SETTINGS_WORDS.has(t) || PAGE_WORDS.has(t));
}

function stripToken(raw: string): string {
  return raw
    .replace(/['’]s$/i, '')
    .replace(/^[^\p{L}\p{N}#+]+/gu, '')
    .replace(/[^\p{L}\p{N}#+./-]+$/gu, '');
}

function fieldWordsForQuery(query: string): Set<string> {
  const words = new Set(FIELD_WORDS);
  const ask = matchRecordAsk(query);
  const spec = ask ? GIZMO_FIELD_SPECS.find((s) => s.key === ask.key) : undefined;
  for (const alias of spec?.aliases ?? []) {
    for (const part of alias.toLowerCase().split(/\s+/)) words.add(part);
  }
  return words;
}

export function extractNameSearchTerm(query: string): string {
  const fieldWords = fieldWordsForQuery(query);
  const kept: string[] = [];
  for (const raw of query.trim().split(/\s+/)) {
    const cleaned = stripToken(raw);
    const n = cleaned.toLowerCase();
    if (!n || n.length < 2) continue;
    if (EXTRACT_FILLER.has(n) || fieldWords.has(n) || INTENT_WORDS.has(n) || RECORD_TYPE_WORDS.has(n)) {
      continue;
    }
    if (!/^[a-z][a-z'-]+$/i.test(cleaned) && !/^\d/.test(cleaned)) continue;
    kept.push(cleaned);
  }
  return kept.join(' ').trim();
}

function identifierTerm(query: string): string | null {
  const uuid = query.match(UUID_HINT)?.[0];
  if (uuid) return uuid;
  const member = query.match(MEMBER_NUM)?.[0];
  if (member) return member.replace(/^[^\d]+/, '').trim() || member;
  const phone = query.match(PHONE_HINT)?.[0];
  if (phone) return phone;
  const email = query.match(EMAIL_HINT)?.[0];
  if (email) return email;
  return null;
}

/**
 * Classify a Gizmo query: should we search records, is this a person ask,
 * what term to send to the DB, and which field the user wanted spoken.
 */
export function parseRecordQuery(query: string): ParsedRecordQuery {
  const q = query.trim();
  if (!q) return EMPTY;

  const askedField = detectAskedField(q);
  const ident = identifierTerm(q);
  if (ident) {
    return {
      shouldSearch: true,
      isPersonLookup: true,
      searchTerm: ident,
      askedField:
        askedField ??
        (EMAIL_HINT.test(ident)
          ? { key: 'email', label: 'email' }
          : PHONE_HINT.test(ident)
            ? { key: 'phone', label: 'phone' }
            : null),
    };
  }

  const placeOrHowto = looksLikePlaceQuery(q) || looksLikeHowtoQuery(q);
  const rest = remainderAfterIntent(q);
  const restNorm = normalizeQuery(rest);
  const pageRest = restIsPageWord(restNorm);
  const extracted = extractNameSearchTerm(rest || q);

  if (placeOrHowto) {
    const shouldSearch = Boolean(rest) && isNameish(rest) && !pageRest;
    return {
      shouldSearch,
      isPersonLookup: shouldSearch,
      searchTerm: shouldSearch ? extracted || rest : q,
      askedField: shouldSearch ? askedField : null,
    };
  }

  if (FIND_HINT.test(q) && q.split(/\s+/).length >= 2) {
    if (!restNorm || pageRest || isSettingsish(rest) || (RECORD_TYPE_WORDS.has(restNorm) && !extracted)) {
      return { shouldSearch: false, isPersonLookup: false, searchTerm: q, askedField: null };
    }
    const term = extracted || rest;
    const shouldSearch = isSearchableTerm(term) || isNameish(rest) || !PAGE_WORDS.has(restNorm);
    return {
      shouldSearch,
      isPersonLookup: shouldSearch,
      searchTerm: term,
      askedField,
    };
  }

  if (askedField && (extracted || /\bmy\b/i.test(q))) {
    return { shouldSearch: true, isPersonLookup: true, searchTerm: extracted, askedField };
  }

  if (POSSESSIVE_NAME.test(q) && extracted && isSearchableTerm(extracted)) {
    return { shouldSearch: true, isPersonLookup: true, searchTerm: extracted, askedField };
  }

  if (isNameish(q)) {
    const settingsTitle = isSettingsish(q);
    return {
      shouldSearch: !settingsTitle,
      isPersonLookup: !settingsTitle,
      searchTerm: extracted || q,
      askedField,
    };
  }

  if (extracted && isSearchableTerm(extracted)) {
    return { shouldSearch: true, isPersonLookup: true, searchTerm: extracted, askedField };
  }

  return { shouldSearch: false, isPersonLookup: false, searchTerm: q, askedField: null };
}

export function looksLikeRecordQuery(query: string): boolean {
  return parseRecordQuery(query).shouldSearch;
}
