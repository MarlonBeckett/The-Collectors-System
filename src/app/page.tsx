import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import {
  RectangleStackIcon,
  WrenchScrewdriverIcon,
  FolderIcon,
  BellAlertIcon,
  UserGroupIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { LandingNav } from '@/components/layout/LandingNav';

const features = [
  {
    icon: RectangleStackIcon,
    title: 'Vehicle Database',
    description: 'Track every vehicle with photos, VIN, plates, mileage history',
  },
  {
    icon: WrenchScrewdriverIcon,
    title: 'Service & Maintenance Log',
    description: 'Record oil changes, repairs, upgrades with costs and receipts',
  },
  {
    icon: FolderIcon,
    title: 'Document Storage',
    description: 'Store titles, registration, insurance in your digital glove box',
  },
  {
    icon: BellAlertIcon,
    title: 'Expiration Alerts',
    description: 'Never miss a tab renewal or insurance expiration',
  },
  {
    icon: UserGroupIcon,
    title: 'Collection Sharing',
    description: 'Invite family or friends to view or help manage',
  },
  {
    icon: ArrowsRightLeftIcon,
    title: 'Import & Export',
    description: 'Bulk CSV import/export and photo import',
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'The Collectors System',
    description:
      'Track and manage your vehicle collection — photos, mileage tracking, service history, documents, expiration alerts, and more.',
    url: 'https://thecollectorssystem.com',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        description: 'Up to 3 vehicles with photos, documents, service log, and mileage tracking',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '5',
        priceCurrency: 'USD',
        description:
          'Unlimited vehicles, expiration alerts, collection sharing, and priority support',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Navigation */}
      <LandingNav isLoggedIn={isLoggedIn} />

      {/* Hero Section */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Your Garage. Organized.
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Track every vehicle in your collection — from daily drivers to weekend toys.
            Photos, service history, documents, and more.
          </p>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90"
            >
              Get Started — It&apos;s Free
            </Link>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-card">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Everything You Need
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 bg-background border border-border"
              >
                <feature.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Simple Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Plan */}
            <div className="flex flex-col p-6 bg-card border border-border">
              <h3 className="text-2xl font-bold text-foreground mb-2">Free</h3>
              <p className="text-4xl font-bold text-foreground mb-6">
                $0<span className="text-lg font-normal text-muted-foreground">/month</span>
              </p>
              <ul className="space-y-3 mb-8 text-foreground flex-1">
                <li className="flex items-start gap-2">
                  <span className="text-secondary font-bold">&#10003;</span>
                  Up to 3 vehicles
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary font-bold">&#10003;</span>
                  Photos & documents
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary font-bold">&#10003;</span>
                  Service log
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary font-bold">&#10003;</span>
                  Mileage tracking
                </li>
              </ul>
              <Link
                href="/signup"
                className="block w-full py-3 px-4 bg-primary text-primary-foreground font-semibold text-center hover:opacity-90"
              >
                Get Started
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="flex flex-col p-6 bg-card border border-primary relative">
              <span className="absolute top-4 right-4 px-2 py-1 text-xs font-semibold bg-green-500 text-white">
                Save 33%
              </span>
              <h3 className="text-2xl font-bold text-foreground mb-2">Pro</h3>
              <div className="mb-6">
                <p className="text-4xl font-bold text-foreground">
                  $5<span className="text-lg font-normal text-muted-foreground">/month</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or $40/year (save $20)
                </p>
              </div>
              <ul className="space-y-3 mb-8 text-foreground flex-1">
                <li className="flex items-start gap-2">
                  <span className="text-secondary font-bold">&#10003;</span>
                  Unlimited vehicles
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary font-bold">&#10003;</span>
                  Expiration alerts & reminders
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary font-bold">&#10003;</span>
                  Collection sharing
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-secondary font-bold">&#10003;</span>
                  Priority support
                </li>
              </ul>
              <Link
                href="/signup"
                className="block w-full py-3 px-4 bg-primary text-primary-foreground font-semibold text-center hover:opacity-90"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm">Product</h4>
              <div className="flex flex-col gap-2">
                <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
                <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm">Support</h4>
              <div className="flex flex-col gap-2">
                <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground">Contact</Link>
                <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm">Legal</h4>
              <div className="flex flex-col gap-2">
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm">Account</h4>
              <div className="flex flex-col gap-2">
                {isLoggedIn ? (
                  <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
                ) : (
                  <>
                    <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign In</Link>
                    <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground">Sign Up</Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <p className="text-muted-foreground text-sm text-center">
              &copy; 2026 The Collectors System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
