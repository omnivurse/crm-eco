import type { MetadataRoute } from 'next';

/** Empty while the PIN gate is up — do not advertise any URLs to crawlers. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
