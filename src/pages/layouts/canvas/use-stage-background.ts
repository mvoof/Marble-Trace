import { useEffect, useState } from 'react';

import { resolveBackgroundSrc } from '@entities/layout/layout-background';

interface ResolvedBackground {
  raw: string;
  src: string | undefined;
}

/**
 * The picture behind the stage when one screen fills it, preloaded so it
 * appears whole; `isBackgroundLoading` covers the gap until it can be drawn.
 *
 * Loading is derived from which picture was last resolved rather than set by
 * an effect, so it is true in the very render that names a new picture — no
 * visible gap between the upload spinner going and the load spinner coming.
 * Until then the previous picture stays up.
 */
export const useStageBackground = (rawBackground: string | undefined) => {
  const [resolved, setResolved] = useState<ResolvedBackground | null>(null);

  useEffect(() => {
    if (!rawBackground) {
      return;
    }

    let isEffectActive = true;

    const settle = (src: string | undefined) => {
      if (isEffectActive) {
        setResolved({ raw: rawBackground, src });
      }
    };

    void resolveBackgroundSrc(rawBackground)
      .then((resolvedSrc) => {
        if (!resolvedSrc) {
          settle(undefined);

          return;
        }

        const imagePreloader = new Image();
        imagePreloader.src = resolvedSrc;

        imagePreloader.onload = () => settle(resolvedSrc);

        imagePreloader.onerror = (preloadError) => {
          console.error('Failed to preload background image:', preloadError);
          settle(resolvedSrc);
        };
      })
      .catch((resolveError) => {
        console.error('Failed to resolve background source:', resolveError);

        if (isEffectActive) {
          setResolved((previous) => ({
            raw: rawBackground,
            src: previous?.src,
          }));
        }
      });

    return () => {
      isEffectActive = false;
    };
  }, [rawBackground]);

  return {
    backgroundSrc: rawBackground ? resolved?.src : undefined,
    isBackgroundLoading:
      Boolean(rawBackground) && resolved?.raw !== rawBackground,
  };
};
