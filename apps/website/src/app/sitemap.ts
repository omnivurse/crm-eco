import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://payitforwardhealth.com';

  const staticPages = [
    '',
    '/about',
    '/plans',
    '/how-it-works',
    '/faq',
    '/contact',
    '/blog',
    '/for-advisors',
    '/enroll',
    '/legal/terms',
    '/legal/privacy',
    '/legal/sharing-guidelines',
  ];

  return staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/plans' || path === '/enroll' ? 0.9 : 0.7,
  }));
}
