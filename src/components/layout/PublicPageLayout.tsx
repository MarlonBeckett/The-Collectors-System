import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { LandingNav } from './LandingNav';

interface PublicPageLayoutProps {
  children: React.ReactNode;
}

export async function PublicPageLayout({ children }: PublicPageLayoutProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingNav isLoggedIn={isLoggedIn} />

      <main className="flex-1">
        {children}
      </main>

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
