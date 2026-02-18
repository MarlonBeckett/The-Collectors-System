'use client';

import Link from 'next/link';

interface ShareShellProps {
  collectionName: string;
  children: React.ReactNode;
}

export function ShareShell({ collectionName, children }: ShareShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted-foreground">Shared Collection</div>
            <h1 className="text-lg font-semibold truncate">{collectionName}</h1>
          </div>
          <Link
            href="/signup"
            className="ml-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto">
        {children}
      </main>
    </div>
  );
}
