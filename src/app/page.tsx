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
    description: 'Keep a detailed profile for every vehicle — photos, VIN, plates, and full mileage history. Everything you need at a glance, whether you\u2019re at the shop or showing off at a car meet.',
  },
  {
    icon: WrenchScrewdriverIcon,
    title: 'Service & Maintenance Log',
    description: 'Log every oil change, repair, and upgrade with costs and receipt photos. Build a complete service history that adds value when it\u2019s time to sell or insure.',
  },
  {
    icon: FolderIcon,
    title: 'Document Storage',
    description: 'Store titles, registrations, and insurance docs in your digital glove box. No more digging through filing cabinets when renewal time comes around.',
  },
  {
    icon: BellAlertIcon,
    title: 'Expiration Alerts',
    description: 'Get notified before your registration, insurance, or inspection expires. Set it once and never worry about a lapsed tag again.',
  },
  {
    icon: UserGroupIcon,
    title: 'Collection Sharing',
    description: 'Invite family members or friends with view-only or editor access. Great for shared households, estate planning, or letting your mechanic see the full history.',
  },
  {
    icon: ArrowsRightLeftIcon,
    title: 'Import & Export',
    description: 'Bring your existing data in with bulk CSV import, or export everything anytime. Your data is always yours.',
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
          <p className="text-lg sm:text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            Track every vehicle in your collection — cars, motorcycles, boats, and more.
            Photos, service history, documents, expiration alerts, all in one place.
          </p>
          <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
            Built for collectors and enthusiasts who take their garage seriously.
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
            Everything You Need to Manage Your Collection
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
            Simple, Transparent Pricing
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
                  Faster support response
                </li>
              </ul>
              <Link
                href="/signup"
                className="block w-full py-3 px-4 bg-primary text-primary-foreground font-semibold text-center hover:opacity-90"
              >
                Go Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 px-4 bg-card">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-8">
            Trusted by Collectors
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-background border border-border">
              <p className="text-muted-foreground italic mb-4">
                &ldquo;Finally a simple way to keep track of all my vehicles without spreadsheets. The expiration alerts alone are worth it.&rdquo;
              </p>
              <p className="text-sm font-semibold text-foreground">— Car Collector</p>
            </div>
            <div className="p-6 bg-background border border-border">
              <p className="text-muted-foreground italic mb-4">
                &ldquo;I have 8 motorcycles and used to lose track of registrations constantly. This app solved that problem on day one.&rdquo;
              </p>
              <p className="text-sm font-semibold text-foreground">— Motorcycle Enthusiast</p>
            </div>
            <div className="p-6 bg-background border border-border">
              <p className="text-muted-foreground italic mb-4">
                &ldquo;Being able to share my collection with my family and mechanic makes everything easier. Great tool.&rdquo;
              </p>
              <p className="text-sm font-semibold text-foreground">— Boat Owner</p>
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
                <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">Blog</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3 text-sm">Support</h4>
              <div className="flex flex-col gap-2">
                <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground">Contact</Link>
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
