'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  HomeIcon,
  PlusCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
} from '@heroicons/react/24/solid';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeIcon: React.ComponentType<{ className?: string }>;
  requiresEditAccess?: boolean;
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
  { href: '/vehicles/new', label: 'Add', icon: PlusCircleIcon, activeIcon: PlusCircleIconSolid, requiresEditAccess: true },
  { href: '/settings', label: 'Settings', icon: Cog6ToothIcon, activeIcon: Cog6ToothIconSolid },
];

export function BottomNav() {
  const pathname = usePathname();
  const [canEdit, setCanEdit] = useState(true); // Default to true to avoid flash
  const supabase = createClient();

  useEffect(() => {
    async function checkEditAccess() {
      const { data: collections } = await supabase.rpc('get_user_collections');
      const hasEditAccess = (collections || []).some(
        (c: { is_owner: boolean; role: string }) => c.is_owner || c.role === 'editor'
      );
      setCanEdit(hasEditAccess);
    }
    checkEditAccess();
  }, [supabase]);

  const navItems = allNavItems.filter(item => !item.requiresEditAccess || canEdit);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
      <div className="flex items-center justify-around h-20">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = isActive ? item.activeIcon : item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full min-h-[44px] ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
