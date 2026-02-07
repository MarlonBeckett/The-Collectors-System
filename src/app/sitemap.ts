import type { MetadataRoute } from 'next';

const staticLastModified = '2026-02-07';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://thecollectorssystem.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://thecollectorssystem.com/login',
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://thecollectorssystem.com/signup',
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://thecollectorssystem.com/about',
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://thecollectorssystem.com/faq',
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://thecollectorssystem.com/support',
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: 'https://thecollectorssystem.com/privacy',
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: 'https://thecollectorssystem.com/terms',
      lastModified: staticLastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
