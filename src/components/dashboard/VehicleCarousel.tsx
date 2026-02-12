'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Motorcycle } from '@/types/database';
import { getVehicleDisplayName } from '@/lib/vehicleUtils';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

interface VehicleCarouselProps {
  vehicles: Motorcycle[];
  vehiclePhotoMap: Record<string, string>; // vehicleId → signed URL (pre-generated server-side)
}

export function VehicleCarousel({ vehicles, vehiclePhotoMap }: VehicleCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter to only vehicles with showcase photos
  const showcaseVehicles = vehicles.filter(v => vehiclePhotoMap[v.id]);

  // Reset to slide 0 when vehicle list changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [vehiclePhotoMap]);

  // Auto-advance every 5 seconds
  const resetAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    if (showcaseVehicles.length > 1) {
      autoAdvanceRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % showcaseVehicles.length);
      }, 5000);
    }
  }, [showcaseVehicles.length]);

  useEffect(() => {
    resetAutoAdvance();
    return () => {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    };
  }, [resetAutoAdvance]);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
    resetAutoAdvance();
  }, [resetAutoAdvance]);

  const goNext = useCallback(() => {
    goTo((currentIndex + 1) % showcaseVehicles.length);
  }, [currentIndex, showcaseVehicles.length, goTo]);

  const goPrev = useCallback(() => {
    goTo((currentIndex - 1 + showcaseVehicles.length) % showcaseVehicles.length);
  }, [currentIndex, showcaseVehicles.length, goTo]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
  };

  if (showcaseVehicles.length === 0) return null;

  const currentVehicle = showcaseVehicles[currentIndex];
  const currentUrl = vehiclePhotoMap[currentVehicle.id];

  const displayName = getVehicleDisplayName(currentVehicle);

  return (
    <div className="relative w-full overflow-hidden rounded-lg mb-4">
      <Link
        href={`/vehicles/${currentVehicle.id}`}
        className="block relative w-full aspect-[16/9] max-h-[300px] bg-muted"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Preload adjacent images for instant transitions */}
        {showcaseVehicles.map((v, idx) => {
          const url = vehiclePhotoMap[v.id];
          if (!url) return null;
          const isVisible = idx === currentIndex;
          const isAdjacent =
            idx === (currentIndex + 1) % showcaseVehicles.length ||
            idx === (currentIndex - 1 + showcaseVehicles.length) % showcaseVehicles.length;
          if (!isVisible && !isAdjacent) return null;
          return (
            <Image
              key={v.id}
              src={url}
              alt={getVehicleDisplayName(v)}
              fill
              className={`object-cover transition-opacity duration-500 ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              sizes="(max-width: 768px) 100vw, 896px"
              unoptimized
              priority={isVisible}
            />
          );
        })}

        {/* Bottom gradient overlay with vehicle info */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-16">
          <p className="text-white font-semibold text-lg leading-tight drop-shadow-sm">
            {displayName}
          </p>
          {currentVehicle.nickname && (
            <p className="text-white/80 text-sm drop-shadow-sm">&ldquo;{currentVehicle.nickname}&rdquo;</p>
          )}
        </div>
      </Link>

      {/* Navigation arrows */}
      {showcaseVehicles.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 text-white hover:bg-black/60 transition-colors rounded-full"
            aria-label="Previous vehicle"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 text-white hover:bg-black/60 transition-colors rounded-full"
            aria-label="Next vehicle"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Indicators */}
      {showcaseVehicles.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {showcaseVehicles.length <= 12 ? (
            showcaseVehicles.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.preventDefault(); goTo(idx); }}
                className={`rounded-full transition-all ${
                  idx === currentIndex
                    ? 'w-2.5 h-2.5 bg-white'
                    : 'w-2 h-2 bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))
          ) : (
            <span className="text-white text-xs font-medium bg-black/50 px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {showcaseVehicles.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
