import { DEFAULT_LAB_PARTNERS, type LabPartnerDefinition } from './partners';
import type { ServiceProvider } from '@/components/services/ServiceProviderGrid';

function hostKey(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function toServiceProvider(partner: LabPartnerDefinition): ServiceProvider {
  return {
    id: partner.id,
    name: partner.name,
    description: partner.description,
    logo_url: partner.logo_url,
    external_url: partner.external_url,
    sso_kind: 'none',
  };
}

/**
 * Ensures Own Your Labs and Health Cost Labs appear on /services/labs even before
 * an org admin seeds `service_providers`. DB rows override defaults when the host matches.
 */
export function mergeLabServiceProviders(dbProviders: ServiceProvider[]): ServiceProvider[] {
  const byHost = new Map<string, ServiceProvider>();

  for (const partner of DEFAULT_LAB_PARTNERS) {
    const key = hostKey(partner.external_url);
    if (key) byHost.set(key, toServiceProvider(partner));
  }

  for (const row of dbProviders) {
    const key = hostKey(row.external_url);
    if (key) byHost.set(key, row);
  }

  return Array.from(byHost.values()).sort((a, b) => {
    const order = (p: ServiceProvider) => {
      const def = DEFAULT_LAB_PARTNERS.find((d) => hostKey(d.external_url) === hostKey(p.external_url));
      return def?.sort_order ?? 999;
    };
    return order(a) - order(b);
  });
}
