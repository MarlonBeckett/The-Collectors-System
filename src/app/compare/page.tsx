import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'The Collectors System vs. Alternatives — Vehicle Collection App Comparison',
  description:
    'Compare The Collectors System to GlobalWorkshop, Simply Auto, and Drivvo. See why collectors choose us for vehicle tracking, documents, and expiration alerts.',
  alternates: {
    canonical: '/compare',
  },
  openGraph: {
    title: 'The Collectors System vs. Alternatives',
    description:
      'Compare The Collectors System to other vehicle management apps. Web-based, free tier, transparent pricing.',
    url: '/compare',
  },
};

const comparisonData = [
  {
    feature: 'Web-based (no app install)',
    tcs: true,
    globalWorkshop: true,
    simplyAuto: false,
    drivvo: false,
  },
  {
    feature: 'Free tier',
    tcs: true,
    globalWorkshop: false,
    simplyAuto: true,
    drivvo: true,
  },
  {
    feature: 'Transparent pricing ($5/mo)',
    tcs: true,
    globalWorkshop: false,
    simplyAuto: true,
    drivvo: true,
  },
  {
    feature: 'Multi-vehicle-type support',
    tcs: true,
    globalWorkshop: true,
    simplyAuto: false,
    drivvo: false,
  },
  {
    feature: 'Document storage',
    tcs: true,
    globalWorkshop: true,
    simplyAuto: false,
    drivvo: false,
  },
  {
    feature: 'Expiration alerts',
    tcs: true,
    globalWorkshop: false,
    simplyAuto: true,
    drivvo: true,
  },
  {
    feature: 'Collection sharing',
    tcs: true,
    globalWorkshop: true,
    simplyAuto: false,
    drivvo: false,
  },
  {
    feature: 'Photo galleries',
    tcs: true,
    globalWorkshop: true,
    simplyAuto: true,
    drivvo: false,
  },
  {
    feature: 'CSV import/export',
    tcs: true,
    globalWorkshop: false,
    simplyAuto: false,
    drivvo: true,
  },
  {
    feature: 'Built for collectors',
    tcs: true,
    globalWorkshop: true,
    simplyAuto: false,
    drivvo: false,
  },
];

export default function ComparePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'The Collectors System vs. Alternatives',
    description:
      'Compare The Collectors System to other vehicle management apps.',
    url: 'https://thecollectorssystem.com/compare',
  };

  return (
    <PublicPageLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
          The Collectors System vs. Alternatives
        </h1>

        <div className="space-y-8 text-foreground">
          <section>
            <p className="text-muted-foreground leading-relaxed text-lg">
              There are several ways to track your vehicles, from spreadsheets to mobile apps
              to specialized platforms. Here is how The Collectors System compares to some
              popular alternatives so you can decide what fits your needs best.
            </p>
          </section>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full border border-border text-sm">
              <thead>
                <tr className="bg-card">
                  <th className="text-left p-3 border-b border-border font-semibold">Feature</th>
                  <th className="text-center p-3 border-b border-border font-semibold text-primary">TCS</th>
                  <th className="text-center p-3 border-b border-border font-semibold">GlobalWorkshop</th>
                  <th className="text-center p-3 border-b border-border font-semibold">Simply Auto</th>
                  <th className="text-center p-3 border-b border-border font-semibold">Drivvo</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row) => (
                  <tr key={row.feature} className="border-b border-border">
                    <td className="p-3 text-foreground">{row.feature}</td>
                    <td className="p-3 text-center">
                      {row.tcs ? (
                        <span className="text-secondary font-bold">&#10003;</span>
                      ) : (
                        <span className="text-muted-foreground">&#10007;</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.globalWorkshop ? (
                        <span className="text-secondary font-bold">&#10003;</span>
                      ) : (
                        <span className="text-muted-foreground">&#10007;</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.simplyAuto ? (
                        <span className="text-secondary font-bold">&#10003;</span>
                      ) : (
                        <span className="text-muted-foreground">&#10007;</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.drivvo ? (
                        <span className="text-secondary font-bold">&#10003;</span>
                      ) : (
                        <span className="text-muted-foreground">&#10007;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section>
            <h2 className="text-xl font-semibold mb-3">Why Choose The Collectors System?</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">Web-based, no app to install.</strong>{' '}
                The Collectors System runs in your browser on any device. No app store
                downloads, no updates to manage, no storage taken up on your phone. Add it
                to your home screen for an app-like experience.
              </p>
              <p>
                <strong className="text-foreground">Free tier with real features.</strong>{' '}
                Track up to 3 vehicles for free with photos, documents, service logs, and
                mileage tracking. No trial period, no credit card required.
              </p>
              <p>
                <strong className="text-foreground">Transparent, affordable pricing.</strong>{' '}
                Pro is $5/month or $40/year. No hidden fees, no per-vehicle charges, no
                surprise upsells. Unlimited vehicles, expiration alerts, and collection
                sharing included.
              </p>
              <p>
                <strong className="text-foreground">Purpose-built for collectors.</strong>{' '}
                Unlike generic maintenance apps designed for tracking a single commuter car,
                The Collectors System is built for people who own multiple vehicles. Cars,
                motorcycles, boats, trailers — all in one place with photo galleries,
                document storage, and sharing built in.
              </p>
              <p>
                <strong className="text-foreground">Your data is yours.</strong>{' '}
                Export your entire collection to CSV anytime. Import existing data with bulk
                CSV import. No lock-in, no data hostage situations.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">About the Alternatives</h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">GlobalWorkshop</strong> is a well-known
                platform aimed at car collectors and restoration shops. It offers detailed
                project tracking and documentation but comes with higher pricing and a
                steeper learning curve. If you are running a professional restoration shop,
                it may be a good fit. For personal collection management, The Collectors
                System offers a simpler, more affordable alternative.
              </p>
              <p>
                <strong className="text-foreground">Simply Auto</strong> is a mobile-only
                app focused on single-vehicle maintenance tracking with fuel logging and
                service reminders. It works well for daily driver maintenance but lacks
                multi-vehicle collection features, document storage, and sharing.
              </p>
              <p>
                <strong className="text-foreground">Drivvo</strong> is another mobile
                maintenance tracker with fuel and expense logging. Like Simply Auto, it is
                designed for individual vehicle maintenance rather than managing a collection
                of multiple vehicles across different types.
              </p>
            </div>
          </section>

          <div className="pt-4">
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90"
            >
              Try The Collectors System — Free
            </Link>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
