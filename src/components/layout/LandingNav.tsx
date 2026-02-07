'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bars3Icon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { LandingSidebar } from './LandingSidebar';

interface LandingNavProps {
  isLoggedIn: boolean;
}

export function LandingNav({ isLoggedIn }: LandingNavProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Open menu"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <Link href="/" className="font-bold text-xl text-foreground">
              <span className="sm:hidden">TCS</span>
              <span className="hidden sm:inline">The Collectors System</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <SunIcon className="w-5 h-5" />
              ) : (
                <MoonIcon className="w-5 h-5" />
              )}
            </button>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold hover:opacity-90"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-foreground hover:text-primary"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold hover:opacity-90"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <LandingSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isLoggedIn={isLoggedIn}
      />
    </>
  );
}
