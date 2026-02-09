'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Photo } from '@/types/database';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface PhotoGalleryProps {
  photos: Photo[];
  motorcycleName: string;
  imageUrls: Record<string, string>;
  onFirstImageLoad?: () => void;
}

// Schedule work during idle time, with fallback for Safari
const scheduleIdle = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (cb: () => void) => setTimeout(cb, 16);
const cancelIdle = typeof cancelIdleCallback === 'function'
  ? cancelIdleCallback
  : (id: number) => clearTimeout(id);

export function PhotoGallery({ photos, motorcycleName, imageUrls, onFirstImageLoad }: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const firstLoadFired = useRef(false);
  const thumbContainerRef = useRef<HTMLDivElement>(null);

  // After main image loads, inject thumbnail background-images directly into
  // the DOM one at a time during idle frames. This bypasses React entirely —
  // no state updates, no reconciliation, no layout thrashing from new <img> nodes.
  // CSS background-image is GPU-composited and doesn't cause reflow.
  useEffect(() => {
    if (!mainImageLoaded) return;
    const container = thumbContainerRef.current;
    if (!container) return;

    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-thumb-url]');
    if (buttons.length === 0) return;

    let cancelled = false;
    let i = 0;
    let idleId: number;

    const revealNext = () => {
      if (cancelled || i >= buttons.length) return;
      const btn = buttons[i];
      const url = btn.dataset.thumbUrl;
      if (url) {
        const shimmer = btn.querySelector<HTMLDivElement>('.skeleton-shimmer');
        // Set background image on the button itself (it's already position:relative)
        btn.style.backgroundImage = `url("${url}")`;
        btn.style.backgroundSize = 'cover';
        btn.style.backgroundPosition = 'center';
        if (shimmer) shimmer.style.display = 'none';
      }
      i++;
      if (i < buttons.length) {
        idleId = scheduleIdle(revealNext) as unknown as number;
      }
    };

    // Small delay so the main image paint settles first
    const timer = setTimeout(() => {
      idleId = scheduleIdle(revealNext) as unknown as number;
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelIdle(idleId);
    };
  }, [mainImageLoaded, photos, imageUrls]);

  if (photos.length === 0) {
    return (
      <div className="bg-muted h-48 flex items-center justify-center">
        <p className="text-muted-foreground">No photos yet</p>
      </div>
    );
  }

  const sortedPhotos = [...photos].sort((a, b) => a.display_order - b.display_order);
  const currentPhoto = sortedPhotos[currentIndex];
  const currentUrl = imageUrls[currentPhoto?.id];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? sortedPhotos.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === sortedPhotos.length - 1 ? 0 : prev + 1));
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullscreen) {
        if (e.key === 'ArrowLeft') goToPrevious();
        if (e.key === 'ArrowRight') goToNext();
        if (e.key === 'Escape') setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Handle swipe gestures
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    setTouchStart(null);
  };

  return (
    <>
      {/* Main Gallery */}
      <div
        className="relative bg-muted h-64 sm:h-80 cursor-pointer"
        onClick={() => setIsFullscreen(true)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentUrl ? (
          <Image
            src={currentUrl}
            alt={`${motorcycleName} photo ${currentIndex + 1}`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 800px"
            unoptimized
            priority
            onLoad={() => {
              if (!firstLoadFired.current) {
                firstLoadFired.current = true;
                setMainImageLoaded(true);
                onFirstImageLoad?.();
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-pulse bg-border w-16 h-16" />
          </div>
        )}

        {/* Navigation Arrows */}
        {sortedPhotos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 hover:bg-background transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 hover:bg-background transition-colors"
              aria-label="Next photo"
            >
              <ChevronRightIcon className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Photo Counter */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-background/80 text-sm">
          {currentIndex + 1} / {sortedPhotos.length}
        </div>
      </div>

      {/* Thumbnail Strip — images injected via DOM in idle frames, not React */}
      {sortedPhotos.length > 1 && (
        <div ref={thumbContainerRef} className="flex gap-2 overflow-x-auto p-2 bg-card">
          {sortedPhotos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setCurrentIndex(index)}
              data-thumb-url={imageUrls[photo.id] || ''}
              className={`relative w-16 h-16 flex-shrink-0 overflow-hidden ${
                index === currentIndex ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="w-full h-full skeleton-shimmer" />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Modal */}
      {isFullscreen && currentUrl && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 z-10"
            aria-label="Close fullscreen"
          >
            <XMarkIcon className="w-6 h-6 text-white" />
          </button>

          <Image
            src={currentUrl}
            alt={`${motorcycleName} photo ${currentIndex + 1}`}
            fill
            className="object-contain"
            sizes="100vw"
            unoptimized
            onClick={(e) => e.stopPropagation()}
          />

          {sortedPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20"
                aria-label="Previous photo"
              >
                <ChevronLeftIcon className="w-8 h-8 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20"
                aria-label="Next photo"
              >
                <ChevronRightIcon className="w-8 h-8 text-white" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 text-white">
                {currentIndex + 1} / {sortedPhotos.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
