import type { MetadataRoute } from 'next';
import { getAllPosts } from './blog/posts';

const staticLastModified = '2026-02-07';
const newPagesLastModified = '2026-02-21';

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getAllPosts().map((post) => ({
    url: `https://thecollectorssystem.com/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

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
    {
      url: 'https://thecollectorssystem.com/cars',
      lastModified: newPagesLastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://thecollectorssystem.com/motorcycles',
      lastModified: newPagesLastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://thecollectorssystem.com/boats',
      lastModified: newPagesLastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://thecollectorssystem.com/trailers',
      lastModified: newPagesLastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://thecollectorssystem.com/compare',
      lastModified: newPagesLastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://thecollectorssystem.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...blogPosts,
  ];
}
