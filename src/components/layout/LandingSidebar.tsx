'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface LandingSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
}

export function LandingSidebar({ isOpen, onClose, isLoggedIn }: LandingSidebarProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[300px] bg-card border-r border-border transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-bold text-lg text-foreground">Menu</span>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex flex-col p-4">
          <Link
            href="/"
            onClick={onClose}
            className="py-3 px-2 text-foreground hover:text-primary font-medium"
          >
            Home
          </Link>
          <Link
            href="/about"
            onClick={onClose}
            className="py-3 px-2 text-foreground hover:text-primary font-medium"
          >
            About
          </Link>
          <Link
            href="/faq"
            onClick={onClose}
            className="py-3 px-2 text-foreground hover:text-primary font-medium"
          >
            FAQ
          </Link>
          <Link
            href="/support"
            onClick={onClose}
            className="py-3 px-2 text-foreground hover:text-primary font-medium"
          >
            Support
          </Link>

          <div className="my-3 border-t border-border" />

          <Link
            href="/privacy"
            onClick={onClose}
            className="py-3 px-2 text-muted-foreground hover:text-foreground text-sm"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            onClick={onClose}
            className="py-3 px-2 text-muted-foreground hover:text-foreground text-sm"
          >
            Terms of Service
          </Link>

          <div className="my-3 border-t border-border" />

          {isLoggedIn ? (
            <Link
              href="/dashboard"
              onClick={onClose}
              className="py-3 px-4 bg-primary text-primary-foreground font-semibold text-center hover:opacity-90"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onClose}
                className="py-3 px-2 text-foreground hover:text-primary font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={onClose}
                className="mt-2 py-3 px-4 bg-primary text-primary-foreground font-semibold text-center hover:opacity-90"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
