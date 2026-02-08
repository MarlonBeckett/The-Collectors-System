'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Photo } from '@/types/database';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface PhotoGalleryProps {
  photos: Photo[];
  motorcycleName: string;
  imageUrls: Record<string, string>;
}

export function PhotoGallery({ photos, motorcycleName, imageUrls }: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

      {/* Thumbnail Strip */}
      {sortedPhotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-2 bg-card">
          {sortedPhotos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setCurrentIndex(index)}
              className={`relative w-16 h-16 flex-shrink-0 ${
                index === currentIndex ? 'ring-2 ring-primary' : ''
              }`}
            >
              {imageUrls[photo.id] ? (
                <Image
                  src={imageUrls[photo.id]}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-muted animate-pulse" />
              )}
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
