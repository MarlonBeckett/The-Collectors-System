import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'Boat Management — Registrations, Insurance & Maintenance',
  description:
    'Track your boats with registration alerts, insurance document storage, service logs, and photo galleries. Free to start.',
  alternates: {
    canonical: '/boats',
  },
  openGraph: {
    title: 'Boat Management — Registrations, Insurance & Maintenance',
    description:
      'Track your boats with registration alerts, insurance document storage, service logs, and photo galleries.',
    url: '/boats',
  },
};

export default function BoatsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Boat Management',
    description:
      'Track your boats with registration alerts, insurance document storage, service logs, and photo galleries.',
    url: 'https://thecollectorssystem.com/boats',
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
          Boat Management Made Simple
        </h1>

        <div className="space-y-8 text-foreground">
          <section>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Boat ownership comes with a unique set of paperwork and maintenance demands.
              Between registration renewals, insurance policies, winterization schedules, and
              engine service intervals, things slip through the cracks fast. The Collectors
              System helps you stay on top of it all without the complexity of marine-specific
              software you do not need.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Organize Your Fleet</h2>
            <p className="text-muted-foreground leading-relaxed">
              Create a profile for each boat with make, model, year, hull ID number, and
              registration details. Upload photos to document condition over time — useful
              for insurance claims, pre-season inspections, or just showing off your rig.
              Whether you own a bass boat, a pontoon, a sailboat, or a center console, each
              vessel gets its own dedicated space in your collection.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Service and Maintenance Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              Log engine oil changes, impeller replacements, bottom paint jobs, trailer
              bearing maintenance, and any other service your boat needs. Attach receipts
              and track costs over time. Knowing exactly when you last serviced the lower
              unit or replaced the water pump impeller can prevent expensive breakdowns on
              the water. Boats that come with complete service records command higher resale
              prices and are easier to insure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Never Miss a Registration Renewal</h2>
            <p className="text-muted-foreground leading-relaxed">
              Boat registration deadlines vary by state and are easy to forget, especially
              if your boat is in storage during the off-season. The Collectors System stores
              your registration, insurance, and title documents digitally and alerts you
              before anything expires. No more scrambling to renew before your first launch
              of the season. Keep your insurance cards and registration on your phone instead
              of in a soggy glove box.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Share Access with Family or Marina</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you share a boat with family members or want your marina to have access to
              service records, collection sharing makes it easy. Grant view-only or editor
              access to anyone with an invite code. This is especially helpful for family
              boats where multiple people need to check registration status or log maintenance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Simple and Affordable</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Collectors System is not a bloated marine management platform. It is a
              clean, simple tool for tracking your boats alongside your cars, motorcycles,
              and trailers. The free plan covers up to 3 vehicles. Pro adds unlimited
              vehicles, expiration alerts, and sharing for $5/month. Import your existing
              data with CSV and export anytime.
            </p>
          </section>

          <div className="pt-4">
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90"
            >
              Start Tracking Your Boats — Free
            </Link>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
