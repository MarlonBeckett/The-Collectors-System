import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'Car Collection Manager — Track Your Cars',
  description:
    'Organize your car collection with photos, VIN tracking, service history, document storage, and expiration alerts. Free to start.',
  alternates: {
    canonical: '/cars',
  },
  openGraph: {
    title: 'Car Collection Manager — Track Your Cars',
    description:
      'Organize your car collection with photos, VIN tracking, service history, document storage, and expiration alerts.',
    url: '/cars',
  },
};

export default function CarsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Car Collection Manager',
    description:
      'Organize your car collection with photos, VIN tracking, service history, document storage, and expiration alerts.',
    url: 'https://thecollectorssystem.com/cars',
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
          Car Collection Manager
        </h1>

        <div className="space-y-8 text-foreground">
          <section>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Whether you own a single project car or a full garage of classics, The Collectors
              System gives you a dedicated place to track every detail. No more scattered
              spreadsheets, lost receipts, or forgotten registration dates. Everything about
              your car collection lives in one organized dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Every Detail, One Place</h2>
            <p className="text-muted-foreground leading-relaxed">
              Create a profile for each car with make, model, year, VIN, license plate, and
              nickname. Upload photos to build a visual gallery of your collection. Track
              mileage over time with historical entries so you can see how much each car gets
              driven. Record purchase price and date to keep a clear picture of your investment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Service History That Adds Value</h2>
            <p className="text-muted-foreground leading-relaxed">
              Log oil changes, tire rotations, brake jobs, and any other maintenance or
              modification. Attach receipt photos and track costs so you always know what
              you have spent on each car. A complete service history is one of the most
              valuable things you can have when selling, insuring, or simply maintaining
              a vehicle. Buyers trust documented cars, and insurance companies appreciate
              organized records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Documents and Expiration Alerts</h2>
            <p className="text-muted-foreground leading-relaxed">
              Store your titles, registrations, insurance cards, and inspection certificates
              in a secure digital glove box. The Collectors System sends you alerts before
              registrations or insurance policies expire, so you never get caught with a
              lapsed tag. If you manage multiple cars, this feature alone can save you from
              fines and headaches.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Share Your Collection</h2>
            <p className="text-muted-foreground leading-relaxed">
              Invite family members, a spouse, or even your mechanic to view or help manage
              your cars. Viewer access lets people browse the collection, while editor access
              lets trusted people add service records or update details. This is especially
              useful for shared households, estate planning, or anyone who wants their
              mechanic to have full vehicle history at their fingertips.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Built for Car Collectors</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Collectors System is purpose-built for people who care about their vehicles.
              It supports cars, motorcycles, boats, and trailers in a single account. The free
              plan lets you manage up to 3 vehicles, and Pro unlocks unlimited vehicles with
              expiration alerts and collection sharing for just $5/month.
            </p>
          </section>

          <div className="pt-4">
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90"
            >
              Start Tracking Your Cars — Free
            </Link>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
