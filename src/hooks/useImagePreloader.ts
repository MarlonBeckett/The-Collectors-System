'use client';

import { useState, useEffect } from 'react';

interface UseImagePreloaderOptions {
  timeout?: number;
  skip?: boolean;
}

export function useImagePreloader(
  urls: string[],
  { timeout = 4000, skip = false }: UseImagePreloaderOptions = {}
): { ready: boolean } {
  const [ready, setReady] = useState(skip || urls.length === 0);

  useEffect(() => {
    if (skip || urls.length === 0) {
      setReady(true);
      return;
    }

    let cancelled = false;
    let loaded = 0;
    const total = urls.length;

    const check = () => {
      loaded++;
      if (!cancelled && loaded >= total) {
        setReady(true);
      }
    };

    const images = urls.map((url) => {
      const img = new Image();
      img.onload = check;
      img.onerror = check;
      img.src = url;
      return img;
    });

    const timer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, timeout);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [urls, timeout, skip]);

  return { ready };
}
