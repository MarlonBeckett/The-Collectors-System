import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://thecollectorssystem.com'),
  title: {
    default: 'The Collectors System — Vehicle Collection Manager',
    template: '%s | The Collectors System',
  },
  description:
    'Track and manage your vehicle collection — photos, mileage tracking, service history, documents, expiration alerts, and more. Cars, motorcycles, boats, trailers.',
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
  maximumScale: 1,
  userScalable: false,
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Oxanium:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
