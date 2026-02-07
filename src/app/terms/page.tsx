import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for The Collectors System — usage terms, billing, and user responsibilities.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using The Collectors System, you agree to be bound by these
              Terms of Service. If you do not agree to these terms, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must provide a valid email address to create an account. You are responsible
              for maintaining the security of your account credentials. You must be at least
              13 years old to use this service. One person or entity may not maintain more
              than one free account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Billing & Subscriptions</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Free plan provides limited access at no cost. The Pro plan is available as
              a monthly ($5/month) or annual ($40/year) subscription. Payments are processed
              by Stripe. Subscriptions auto-renew unless cancelled before the end of the
              current billing period. Refunds are handled on a case-by-case basis — contact
              support if you believe you are owed a refund.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for all content you upload to the service, including vehicle
              data, photos, and documents. You agree not to use the service for any unlawful
              purpose, to upload malicious content, or to attempt to access other users&apos;
              data. You must not abuse, harass, or threaten other users who share collections
              with you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of all content you upload. By using the service, you grant
              us a limited license to store and display your content as necessary to provide
              the service. The Collectors System name, logo, and application code are our
              intellectual property.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The service is provided &quot;as is&quot; without warranties of any kind. We are
              not liable for any data loss, service interruptions, or damages arising from
              your use of the service. While we take reasonable measures to protect your data,
              you are encouraged to maintain your own backups using the CSV export feature.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may delete your account at any time from your account settings. We reserve
              the right to suspend or terminate accounts that violate these terms. Upon
              termination, your data will be deleted in accordance with our privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these terms from time to time. Continued use of the service after
              changes are posted constitutes acceptance of the revised terms. We will make
              reasonable efforts to notify users of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these terms, please reach out through our support page.
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
}
