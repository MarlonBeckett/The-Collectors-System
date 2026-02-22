import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';
import { getAllPosts } from './posts';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Tips, guides, and resources for vehicle collectors. Learn how to organize your collection, track maintenance, and manage registrations.',
  alternates: {
    canonical: '/blog',
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Blog
        </h1>
        <p className="text-muted-foreground mb-10 text-lg">
          Tips, guides, and resources for vehicle collectors and enthusiasts.
        </p>

        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block p-6 bg-card border border-border hover:border-primary transition-colors"
            >
              <p className="text-sm text-muted-foreground mb-2">
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {post.title}
              </h2>
              <p className="text-muted-foreground">
                {post.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </PublicPageLayout>
  );
}
