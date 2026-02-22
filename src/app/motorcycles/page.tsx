import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'Motorcycle Collection Manager — Track Your Bikes',
  description:
    'Manage your motorcycle collection with photos, VIN tracking, service logs, document storage, and registration alerts. Free to start.',
  alternates: {
    canonical: '/motorcycles',
  },
  openGraph: {
    title: 'Motorcycle Collection Manager — Track Your Bikes',
    description:
      'Manage your motorcycle collection with photos, VIN tracking, service logs, document storage, and registration alerts.',
    url: '/motorcycles',
  },
};

export default function MotorcyclesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Motorcycle Collection Manager',
    description:
      'Manage your motorcycle collection with photos, VIN tracking, service logs, document storage, and registration alerts.',
    url: 'https://thecollectorssystem.com/motorcycles',
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
          Motorcycle Collection Manager
        </h1>

        <div className="space-y-8 text-foreground">
          <section>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Motorcycle enthusiasts know the challenge: multiple bikes, each with their own
              registration dates, insurance policies, maintenance schedules, and modification
              history. The Collectors System puts all of that in one place so you can spend
              more time riding and less time digging through paperwork.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Track Every Bike in Your Stable</h2>
            <p className="text-muted-foreground leading-relaxed">
              Whether it is a daily rider, a weekend cruiser, a track day sportbike, or a
              vintage restoration project, every motorcycle gets its own profile. Record the
              make, model, year, VIN, plate number, and any nickname you use. Upload photos
              to build a visual record of your collection from stock to fully built. Track
              mileage over time to see how each bike gets used across seasons.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Maintenance and Modification Logs</h2>
            <p className="text-muted-foreground leading-relaxed">
              Motorcycles demand regular maintenance — oil changes, chain adjustments, valve
              checks, tire replacements, brake fluid flushes. Log every service with dates,
              costs, and receipt photos. Track modifications like exhaust upgrades, suspension
              changes, or handlebar swaps. A detailed service history protects your investment
              and makes selling easier when the time comes. Buyers pay more for bikes with
              documented maintenance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Registration and Insurance Alerts</h2>
            <p className="text-muted-foreground leading-relaxed">
              When you have multiple motorcycles, it is easy to let a registration lapse or
              miss an insurance renewal. The Collectors System stores all your documents
              digitally and sends you alerts before anything expires. No more surprises at
              the DMV or discovering an uninsured bike when you need it most. Store titles,
              registration cards, and insurance documents in your secure digital glove box.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Share with Your Riding Crew</h2>
            <p className="text-muted-foreground leading-relaxed">
              Share your collection with friends, family, or your mechanic. Viewer access
              lets people browse your bikes and their history. Editor access lets trusted
              people add service records or update vehicle details. Perfect for riding
              groups, households with multiple riders, or shops that want to see the full
              service history before a bike comes in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Free to Start</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Collectors System supports motorcycles alongside cars, boats, and trailers.
              Track up to 3 vehicles free. Upgrade to Pro for unlimited bikes, expiration
              alerts, and collection sharing at $5/month or $40/year. Your data is always
              exportable — no lock-in, no surprises.
            </p>
          </section>

          <div className="pt-4">
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90"
            >
              Start Tracking Your Motorcycles — Free
            </Link>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
