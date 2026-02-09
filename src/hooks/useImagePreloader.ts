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
  // Stable string key so effect doesn't re-run when array ref changes
  const key = urls.join('\n');

  const [ready, setReady] = useState(() => skip || urls.length === 0);

  useEffect(() => {
    if (skip || urls.length === 0) {
      setReady(true);
      return;
    }

    let cancelled = false;
    let loaded = 0;
    const total = urls.length;

    const done = () => {
      if (!cancelled) setReady(true);
    };

    const check = () => {
      loaded++;
      if (loaded >= total) done();
    };

    const images = urls.map((url) => {
      const img = document.createElement('img');
      img.onload = check;
      img.onerror = check;
      img.src = url;
      return img;
    });

    const timer = setTimeout(done, timeout);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, skip, timeout]);

  return { ready };
}
