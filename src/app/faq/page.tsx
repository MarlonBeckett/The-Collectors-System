import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about The Collectors System — vehicle types, pricing, sharing, data, and more.',
  alternates: {
    canonical: '/faq',
  },
};

const faqs = [
  {
    question: 'What types of vehicles can I track?',
    answer:
      'You can track cars, motorcycles, boats, trailers, and other vehicles. Each vehicle has a type selector so you can categorize your collection however you want.',
  },
  {
    question: 'What\'s the difference between Free and Pro?',
    answer:
      'The Free plan lets you manage up to 3 vehicles with photos, documents, service log, and mileage tracking. Pro gives you unlimited vehicles, expiration alerts and email reminders, collection sharing with other users, and priority support. Pro is $5/month or $40/year.',
  },
  {
    question: 'How does collection sharing work?',
    answer:
      'With a Pro subscription, you can create invite codes for your collection. Other users can join with the code and be assigned an editor or viewer role. Editors can add and modify vehicles; viewers can only browse.',
  },
  {
    question: 'Can I import my existing data?',
    answer:
      'Yes. You can import vehicles from a CSV file with columns for make, model, year, VIN, plate number, mileage, and more. You can also export your entire collection to CSV at any time.',
  },
  {
    question: 'How is my data stored and secured?',
    answer:
      'Your data is stored in a secure PostgreSQL database hosted by Supabase with row-level security enabled. All connections use HTTPS. Photos and documents are stored in encrypted cloud storage. We never sell or share your data.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer:
      'Yes, you can cancel at any time from your account settings. Your Pro features will remain active until the end of your current billing period. After that, your account reverts to the Free plan and you keep your first 3 vehicles.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit and debit cards through Stripe, including Visa, Mastercard, American Express, and Discover. All payment processing is handled securely by Stripe — we never store your card details.',
  },
  {
    question: 'Is there a mobile app?',
    answer:
      'The Collectors System is a web app that works great on mobile browsers. You can add it to your home screen for an app-like experience. A dedicated native app may come in the future.',
  },
];

export default function FAQPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">
          Frequently Asked Questions
        </h1>

        <div className="space-y-6">
          {faqs.map((faq) => (
            <div key={faq.question} className="p-6 bg-card border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                {faq.question}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </PublicPageLayout>
  );
}
