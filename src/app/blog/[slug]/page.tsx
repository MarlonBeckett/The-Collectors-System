import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';
import { getPost, getAllPosts } from '../posts';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

function renderMarkdown(content: string) {
  const lines = content.trim().split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={key++} className="bg-card border border-border p-4 overflow-x-auto text-sm my-4">
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="text-3xl sm:text-4xl font-bold text-foreground mb-6 mt-8 first:mt-0">
          {line.slice(2)}
        </h1>
      );
      i++;
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-xl font-semibold text-foreground mb-3 mt-8">
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-lg font-semibold text-foreground mb-2 mt-6">
          {line.slice(4)}
        </h3>
      );
      i++;
      continue;
    }

    // List items
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="space-y-2 text-muted-foreground my-4 ml-4">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">-</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className="space-y-2 text-muted-foreground my-4 ml-4 list-decimal list-inside">
          {listItems.map((item, idx) => (
            <li key={idx}>
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph
    elements.push(
      <p key={key++} className="text-muted-foreground leading-relaxed my-4">
        <span dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      </p>
    );
    i++;
  }

  return elements;
}

function formatInline(text: string): string {
  // Bold
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>');
  // Links
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-accent hover:underline">$1</a>'
  );
  return result;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    url: `https://thecollectorssystem.com/blog/${post.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'The Collectors System',
      url: 'https://thecollectorssystem.com',
    },
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-8">
          <Link href="/blog" className="text-sm text-accent hover:underline">
            &larr; Back to Blog
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <div>{renderMarkdown(post.content)}</div>
        <div className="mt-12 p-6 bg-card border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Ready to organize your collection?
          </h3>
          <p className="text-muted-foreground mb-4">
            The Collectors System helps you track vehicles, documents, service history, and more. Free for up to 3 vehicles.
          </p>
          <Link
            href="/signup"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground font-semibold hover:opacity-90"
          >
            Get Started — Free
          </Link>
        </div>
      </article>
    </PublicPageLayout>
  );
}
