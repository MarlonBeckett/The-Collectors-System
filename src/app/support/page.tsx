import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';
import { SupportForm } from '@/components/support/SupportForm';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Contact The Collectors System support team. We\'re here to help with any questions or issues.',
  alternates: {
    canonical: '/support',
  },
};

export default function SupportPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Contact Support
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Have a question, found a bug, or need help with your account? Send us a message
          and we&apos;ll get back to you as soon as possible. You can also check our{' '}
          <Link href="/faq" className="text-accent hover:underline">FAQ</Link>{' '}
          for quick answers to common questions.
        </p>

        <SupportForm />
      </div>
    </PublicPageLayout>
  );
}
