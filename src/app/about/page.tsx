import type { Metadata } from 'next';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn why we built The Collectors System — a simple, affordable way to organize your car, motorcycle, and boat collection.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">
          About The Collectors System
        </h1>

        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Collectors System was built for vehicle enthusiasts who want a simple, dedicated
              place to track everything about their collection. Whether you have two cars in the
              garage or twenty motorcycles in the barn, we give you the tools to stay organized
              without the overhead of spreadsheets or scattered notes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">What It Does</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Collectors System is a web app that lets you:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                Store vehicle details — make, model, year, VIN, plates, and notes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                Upload photos and organize them into galleries
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                Track mileage over time with historical entries
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                Log service and maintenance records with costs and receipts
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                Store important documents — titles, registration, insurance
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                Get alerts when tabs or registration are expiring
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                Share your collection with family or friends via invite codes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">-</span>
                Import and export data with CSV for easy migration
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Who It&apos;s For</h2>
            <p className="text-muted-foreground leading-relaxed">
              Anyone who owns vehicles and wants to keep track of them. Car collectors, motorcycle
              enthusiasts, boat owners, people with trailers — if it has wheels (or a hull), it
              belongs in The Collectors System. The free tier lets you manage up to 3 vehicles,
              and Pro unlocks unlimited vehicles with additional features like expiration alerts
              and collection sharing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Built With Care</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Collectors System is an independent project built by an enthusiast, for enthusiasts.
              Your data is stored securely, your privacy is respected, and the app is designed to
              be fast and straightforward — no bloat, no distractions.
            </p>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
}
