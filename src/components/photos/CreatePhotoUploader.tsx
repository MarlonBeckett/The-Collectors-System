'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, XMarkIcon, ArrowsUpDownIcon, StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';

// Schedule work during idle time, with fallback for Safari
const scheduleIdle = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (cb: () => void) => setTimeout(cb, 16);
const cancelIdle = typeof cancelIdleCallback === 'function'
  ? cancelIdleCallback
  : (id: number) => clearTimeout(id);

export interface StagedPhoto {
  file: File;
  previewUrl: string;
  isShowcase: boolean;
}

interface CreatePhotoUploaderProps {
  onPhotosChange: (photos: StagedPhoto[]) => void;
}

export function CreatePhotoUploader({ onPhotosChange }: CreatePhotoUploaderProps) {
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Inject background-images via DOM during idle frames
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cells = grid.querySelectorAll<HTMLDivElement>('[data-photo-url]');
    if (cells.length === 0) return;

    let cancelled = false;
    let i = 0;
    let idleId: number;

    const revealNext = () => {
      if (cancelled || i >= cells.length) return;
      const cell = cells[i];
      const url = cell.dataset.photoUrl;
      if (url && !cell.style.backgroundImage) {
        cell.style.backgroundImage = `url("${url}")`;
        cell.style.backgroundSize = 'cover';
        cell.style.backgroundPosition = 'center';
        const shimmer = cell.querySelector<HTMLDivElement>('.skeleton-shimmer');
        if (shimmer) shimmer.style.display = 'none';
      }
      i++;
      if (i < cells.length) {
        idleId = scheduleIdle(revealNext) as unknown as number;
      }
    };

    idleId = scheduleIdle(revealNext) as unknown as number;

    return () => {
      cancelled = true;
      cancelIdle(idleId);
    };
  }, [photos]);

  // Sync to parent whenever photos change
  useEffect(() => {
    onPhotosChange(photos);
  }, [photos, onPhotosChange]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newPhotos = acceptedFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isShowcase: false,
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleShowcase = (index: number) => {
    setPhotos(prev =>
      prev.map((p, i) => ({
        ...p,
        isShowcase: i === index ? !p.isShowcase : false,
      }))
    );
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      const [moved] = newPhotos.splice(fromIndex, 1);
      newPhotos.splice(toIndex, 0, moved);
      return newPhotos;
    });
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary'
        }`}
      >
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">
          {isDragActive
            ? 'Drop photos here...'
            : 'Drag photos here or tap to select'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          JPG, PNG, WebP, HEIC (max 10MB)
        </p>
      </div>

      {/* Staged Photos */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} staged
            </span>
            <button
              type="button"
              onClick={() => setIsReordering(!isReordering)}
              className={`flex items-center gap-1 text-sm px-2 py-1 ${
                isReordering ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              <ArrowsUpDownIcon className="w-4 h-4" />
              {isReordering ? 'Done' : 'Reorder'}
            </button>
          </div>

          {!photos.some(p => p.isShowcase) && (
            <p className="text-xs text-muted-foreground">
              Tap the star on a photo to feature it in the dashboard carousel.
            </p>
          )}

          <div ref={gridRef} className="grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <div
                key={photo.previewUrl}
                data-photo-url={photo.previewUrl}
                className="relative aspect-square bg-muted group overflow-hidden"
              >
                <div className="w-full h-full skeleton-shimmer" />

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove photo"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>

                {/* Showcase Toggle */}
                <button
                  type="button"
                  onClick={() => toggleShowcase(index)}
                  className={`absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 py-1 ${
                    photo.isShowcase
                      ? 'bg-yellow-500/90 text-black'
                      : 'bg-black/50 text-white/80 hover:bg-black/70'
                  }`}
                  aria-label={photo.isShowcase ? 'Remove from dashboard' : 'Feature on dashboard'}
                >
                  {photo.isShowcase ? (
                    <>
                      <StarSolid className="w-4 h-4" />
                      <span className="text-xs font-medium">Featured</span>
                    </>
                  ) : (
                    <>
                      <StarOutline className="w-4 h-4" />
                      <span className="text-xs">Feature</span>
                    </>
                  )}
                </button>

                {/* Reorder Buttons */}
                {isReordering && (
                  <div className="absolute bottom-8 left-1 right-1 flex gap-1">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => movePhoto(index, index - 1)}
                        className="flex-1 py-1 bg-background/80 text-xs"
                      >
                        &larr;
                      </button>
                    )}
                    {index < photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() => movePhoto(index, index + 1)}
                        className="flex-1 py-1 bg-background/80 text-xs"
                      >
                        &rarr;
                      </button>
                    )}
                  </div>
                )}

                {/* Order Number */}
                <div className="absolute top-1 left-1 w-5 h-5 bg-background/80 flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
