import type { GizmoAppId, GizmoRecordHit } from './types';

const MEMBER_PREFIXES = [
  '/',
  '/coverage',
  '/needs',
  '/dependents',
  '/billing',
  '/documents',
  '/notifications',
  '/plan',
  '/settings',
  '/support',
  '/profile',
  '/services',
] as const;

const ADVISOR_PREFIXES = [
  '/dashboard',
  '/contacts',
  '/pricing',
  '/engagement',
  '/training',
  '/team',
  '/presentations',
  '/settings',
] as const;

const ADMIN_PREFIXES = [
  '/dashboard',
  '/members',
  '/enrollments',
  '/enrollment-links',
  '/billing',
  '/invoices',
  '/commissions',
  '/agents',
  '/vendors',
  '/products',
  '/carriers',
  '/support',
  '/tickets',
  '/communications',
  '/documents',
  '/reports',
  '/analytics',
  '/ops',
  '/settings',
  '/learn',
  '/terminal',
  '/plans',
  '/organizations',
  '/users',
  '/audit',
  '/notifications',
] as const;

function prefixOk(href: string, prefixes: readonly string[]): boolean {
  const path = href.split('?')[0] || href;
  return prefixes.some((p) => {
    if (p === '/') return path === '/' || path === '';
    return path === p || path.startsWith(`${p}/`);
  });
}

export function hrefAllowed(app: GizmoAppId, href: string): boolean {
  if (!href || typeof href !== 'string') return false;
  const trimmed = href.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//') || trimmed.includes('://')) return false;
  if (/[\s<>"'`]/.test(trimmed)) return false;

  switch (app) {
    case 'crm':
      return trimmed === '/crm' || trimmed.startsWith('/crm/');
    case 'admin':
      if (trimmed.startsWith('/crm')) return false;
      return prefixOk(trimmed, ADMIN_PREFIXES);
    case 'member_portal':
      if (trimmed.startsWith('/crm')) return false;
      return prefixOk(trimmed, MEMBER_PREFIXES);
    case 'advisor_portal':
      if (trimmed.startsWith('/crm')) return false;
      return prefixOk(trimmed, ADVISOR_PREFIXES);
    default:
      return false;
  }
}

export function sanitizeRecordHits(
  app: GizmoAppId,
  hits: GizmoRecordHit[],
  cap = 8,
): GizmoRecordHit[] {
  return hits.filter((h) => hrefAllowed(app, h.href)).slice(0, cap);
}

export function extractCandidateHrefs(text: string): string[] {
  const found = new Set<string>();
  if (!text) return [];
  for (const m of text.matchAll(/\]\((\/[^)\s]+)\)/g)) found.add(m[1]);
  for (const m of text.matchAll(/(?:^|[\s"'`(])(\/[A-Za-z0-9/_?=&%-]+)/g)) {
    found.add(m[1].replace(/[.,;:]+$/, ''));
  }
  return [...found];
}

export function stripDisallowedHrefs(
  app: GizmoAppId,
  text: string,
  allowedHrefs: readonly string[],
): string {
  const allow = new Set(allowedHrefs.filter((h) => hrefAllowed(app, h)));
  let next = text;
  next = next.replace(/\[([^\]]+)\]\((\/[^)\s]+)\)/g, (full, label, href) => {
    return allow.has(href) ? full : String(label);
  });
  next = next.replace(/(^|[\s"'`(])(\/[A-Za-z0-9/_?=&%-]+)/g, (full, pre, href) => {
    const clean = String(href).replace(/[.,;:]+$/, '');
    return allow.has(clean) ? full : pre;
  });
  return next.replace(/\n{3,}/g, '\n\n').trim();
}

/** Palette wins. Settings aliases attach when Settings is visible for this role. */
export function attachAliasPlaces<T extends { href: string; aliases: string[]; title: string; group?: string }>(
  palette: T[],
  aliases: T[],
  app: GizmoAppId,
): T[] {
  const out = palette.filter((p) => hrefAllowed(app, p.href));
  const seen = new Set(out.map((p) => p.href));
  const settingsVisible = [...seen].some((h) => h === '/crm/settings' || h.startsWith('/crm/settings/'));
  for (const alias of aliases) {
    if (!hrefAllowed(app, alias.href)) continue;
    const existing = out.find((p) => p.href === alias.href);
    if (existing) {
      existing.aliases = [...new Set([...existing.aliases, ...alias.aliases, alias.title.toLowerCase()])];
      continue;
    }
    if (!palette.length || seen.has(alias.href) || (alias.group === 'settings' && settingsVisible)) {
      out.push(alias);
      seen.add(alias.href);
    }
  }
  return out;
}

export function mergePlacesByHref<T extends { href: string }>(base: T[], extra: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...extra, ...base]) {
    if (!item.href || seen.has(item.href)) continue;
    seen.add(item.href);
    out.push(item);
  }
  return out;
}
