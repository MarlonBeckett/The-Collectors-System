'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FREE_VEHICLE_LIMIT } from '@/lib/subscription';

interface UpgradeBannerProps {
  vehicleCount: number;
}

export default function UpgradeBanner({ vehicleCount }: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || vehicleCount < FREE_VEHICLE_LIMIT) {
    return null;
  }

  return (
    <div className="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 p-4 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-600"
        aria-label="Dismiss"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div className="pr-8">
        <h3 className="font-medium text-zinc-900">
          You&apos;ve reached the free limit
        </h3>
        <p className="text-sm text-zinc-600 mt-1">
          Upgrade to Pro to add unlimited vehicles to your collection.
        </p>
        <Link
          href="/settings#subscription"
          className="inline-block mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Upgrade to Pro &rarr;
        </Link>
      </div>
    </div>
  );
}
