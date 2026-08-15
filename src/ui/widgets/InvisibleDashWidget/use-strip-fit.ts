import { useLayoutEffect, useRef, useState } from 'react';

// Below this the correction is invisible, and applying it anyway would let the
// measurement chase its own tail on every frame.
const FIT_EPSILON = 0.005;
const MIN_FIT = 0.2;
// A hair of slack: the glow and the stroke paint a little past the box the
// measurement sees, and a readout flush with the edge looks clipped even when
// it is not.
const FIT_MARGIN = 0.98;

/**
 * How much the strip has to shrink to fit the widget.
 *
 * Narrowing the dash first spends the empty middle between the clusters — that
 * costs nothing and is what `space-between` does on its own. Once they have met
 * there is nothing left to give, and the readout would simply be cut off at the
 * edges. From that point this scales the whole strip down instead, continuously,
 * so the widget keeps every digit and its caption at any width.
 *
 * Measured off painted geometry, not layout: the tilt and the curvature are
 * transforms, and a cluster yawed toward the driver covers more width than its
 * box says. `getBoundingClientRect` already includes all of that — including the
 * scale being corrected — so the reading is divided back out by the fit in force
 * and the result converges in a pass or two. Nothing here touches layout, so the
 * observer cannot be retriggered by its own output.
 */
export const useStripFit = () => {
  const stripRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef(1);
  const [fit, setFit] = useState(1);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const stage = strip?.parentElement;

    if (!strip || !stage) {
      return;
    }

    // The strip's own box is a fixed 200% of the stage and never grows with its
    // content, so the span that matters is the one the clusters actually cover.
    const paintedSpan = () => {
      let left = Infinity;
      let right = -Infinity;

      for (const child of strip.children) {
        const rect = child.getBoundingClientRect();

        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
      }

      return right - left;
    };

    const measure = () => {
      const available = stage.getBoundingClientRect().width;
      const painted = paintedSpan();
      const current = fitRef.current;

      if (available <= 0 || painted <= 0) {
        return;
      }

      // What the strip would span unscaled, and the scale that makes it fit.
      const unscaled = painted / current;
      const next = Math.max(
        MIN_FIT,
        Math.min(1, (available * FIT_MARGIN) / unscaled)
      );

      if (Math.abs(next - current) < FIT_EPSILON) {
        return;
      }

      fitRef.current = next;
      setFit(next);
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(stage);
    observer.observe(strip);

    for (const child of strip.children) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, []);

  return { stripRef, fit };
};
