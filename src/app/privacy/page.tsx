import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How The Collectors System handles your data, photos, and documents. Read our full privacy policy.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you create an account, we collect your email address and any profile
              information you choose to provide, including your username, first name, last
              name, phone number, and profile photo. When you use the app, we store the
              vehicle data, photos, documents, and other content you add to your collection.
              If you subscribe to a paid plan, payment information is collected and processed
              by Stripe — we do not store your credit card details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use your information to provide and improve the service, including: managing
              your account, storing and displaying your vehicle collection data, sending
              expiration alerts and account notifications you&apos;ve opted into, and processing
              payments. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Data Storage</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored in a PostgreSQL database hosted by Supabase with row-level
              security enabled. Photos, profile avatars, and documents are stored in Supabase
              Storage with encrypted-at-rest storage. All data transmission uses HTTPS encryption.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We use the following third-party services:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                <strong>Supabase</strong> — database hosting, authentication, and file storage
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                <strong>Stripe</strong> — payment processing for Pro subscriptions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                <strong>Vercel</strong> — application hosting and deployment
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Each of these services has their own privacy policies governing how they handle data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to maintain your authentication session and remember
              your preferences (such as theme). We do not use tracking cookies or third-party
              analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You can export your vehicle data at any time using the CSV export feature. You
              can delete your account and all associated data — including your profile
              information, avatar photo, vehicles, and documents — from your account settings.
              If you have questions about your data or want to request its deletion, contact
              us at our support page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this privacy policy, please reach out through
              our support page.
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
}
