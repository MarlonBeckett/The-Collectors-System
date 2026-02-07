import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api', '/settings', '/vehicles', '/bikes', '/import', '/search'],
      },
    ],
    sitemap: 'https://thecollectorssystem.com/sitemap.xml',
  };
}
