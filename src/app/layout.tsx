import type { Metadata, Viewport } from 'next';
import { Oxanium, Source_Code_Pro } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { CookieConsent } from '@/components/layout/CookieConsent';
import './globals.css';

const oxanium = Oxanium({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oxanium',
  display: 'swap',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-source-code-pro',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://thecollectorssystem.com'),
  title: {
    default: 'The Collectors System — Vehicle Collection Manager',
    template: '%s | The Collectors System',
  },
  description:
    'Track and manage your vehicle collection — cars, motorcycles, boats, and more. Photos, service history, documents, expiration alerts. Free to start.',
  keywords: [
    'vehicle collection manager',
    'garage management',
    'mileage tracking',
    'vehicle photos',
    'service history',
    'motorcycle collection',
    'car collection',
    'boat management',
    'registration tracker',
    'expiration alerts',
  ],
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'The Collectors System — Vehicle Collection Manager',
    description:
      'Track every vehicle in your collection — photos, service history, documents, and more.',
    url: '/',
    siteName: 'The Collectors System',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Collectors System — Vehicle Collection Manager',
    description:
      'Track every vehicle in your collection — photos, service history, documents, and more.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'The Collectors',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d4d4d4' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${oxanium.variable} ${sourceCodePro.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var d = document.documentElement;
                var theme = localStorage.getItem('theme');
                var isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  d.classList.add('dark');
                  d.style.backgroundColor = '#1a1a1a';
                  d.style.color = '#e0e0e0';
                } else {
                  d.style.backgroundColor = '#cccccc';
                  d.style.color = '#1f1f1f';
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        {children}
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
