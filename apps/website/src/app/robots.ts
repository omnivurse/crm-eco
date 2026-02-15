import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/enroll/'],
      },
    ],
    sitemap: 'https://payitforwardhealth.com/sitemap.xml',
  };
}
