import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'Trailer Tracking — Registration, Insurance & Documents',
  description:
    'Track your trailers with registration alerts, insurance storage, maintenance logs, and document management. Free to start.',
  alternates: {
    canonical: '/trailers',
  },
  openGraph: {
    title: 'Trailer Tracking — Registration, Insurance & Documents',
    description:
      'Track your trailers with registration alerts, insurance storage, maintenance logs, and document management.',
    url: '/trailers',
  },
};

export default function TrailersPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Trailer Tracking',
    description:
      'Track your trailers with registration alerts, insurance storage, maintenance logs, and document management.',
    url: 'https://thecollectorssystem.com/trailers',
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
          Trailer Tracking Made Easy
        </h1>

        <div className="space-y-8 text-foreground">
          <section>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Trailers are the most commonly overlooked vehicles when it comes to registration
              and maintenance tracking. They sit in a driveway or storage lot for months, and
              when you need them, the registration is expired and the bearings have not been
              greased in years. The Collectors System makes sure that does not happen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Track Every Trailer You Own</h2>
            <p className="text-muted-foreground leading-relaxed">
              Whether it is a utility trailer, car hauler, boat trailer, enclosed cargo
              trailer, or travel trailer, each one gets its own profile. Record the make,
              model, year, VIN, plate number, and any notes about its condition or purpose.
              Upload photos to document condition — useful for insurance, resale, or just
              knowing what you have at a glance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Maintenance You Cannot Afford to Skip</h2>
            <p className="text-muted-foreground leading-relaxed">
              Trailer maintenance is simple but critical. Wheel bearings need repacking,
              tires need inspecting, lights need checking, and brakes (if equipped) need
              servicing. Log every maintenance task with dates, costs, and receipt photos.
              A seized bearing on the highway is expensive and dangerous. A simple log entry
              reminds you when service is due and proves the work was done.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Registration Alerts That Matter</h2>
            <p className="text-muted-foreground leading-relaxed">
              Trailer registration is one of the easiest things to forget. Many states
              require annual renewal, and getting pulled over with expired trailer tags is
              an avoidable hassle. The Collectors System sends you alerts before your
              registration or insurance expires. Store your title, registration card, and
              insurance documents digitally so they are always accessible from your phone
              — even when you are at the storage lot or boat ramp.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Share with Family or Business Partners</h2>
            <p className="text-muted-foreground leading-relaxed">
              Trailers are often shared between family members or used across a small
              business. Collection sharing lets you give view or edit access to anyone who
              needs it. Your spouse can check registration status, your business partner
              can log maintenance, and everyone stays on the same page without phone calls
              or texts asking &ldquo;when did we last service the trailer?&rdquo;
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">All Your Vehicles, One System</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Collectors System tracks trailers alongside your cars, motorcycles, and
              boats. The free plan covers up to 3 vehicles total. Pro gives you unlimited
              vehicles, expiration alerts, and sharing for $5/month. Your data is always
              exportable via CSV.
            </p>
          </section>

          <div className="pt-4">
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90"
            >
              Start Tracking Your Trailers — Free
            </Link>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
