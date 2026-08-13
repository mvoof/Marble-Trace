import { useEffect, type RefObject } from 'react';

import { resizeCanvasToDpr } from '@utils/widget/canvas-dpr';

/**
 * Keeps a canvas' backing store in step with the size its parent gives it and
 * repaints once per resize.
 *
 * The repaint is deferred into `requestAnimationFrame` so a burst of observer
 * callbacks (the overlay scales every widget at once) draws a single frame.
 *
 * `redraw` must be a stable callback — wrap it in `useCallback`, or the
 * observer is torn down and rebuilt on every render.
 */
export const useCanvasAutoResize = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  redraw: () => void
) => {
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let resizeRafId = 0;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        const { width, height } = entry.contentRect;

        if (width <= 0 || height <= 0) {
          return;
        }

        resizeCanvasToDpr(canvas, width, height);
      }

      cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(redraw);
    });

    resizeObserver.observe(canvas.parentElement ?? canvas);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeRafId);
    };
  }, [canvasRef, redraw]);
};
