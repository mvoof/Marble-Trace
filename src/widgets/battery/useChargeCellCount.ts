import { useLayoutEffect, useState, type RefCallback } from 'react';

/** Below this the cells stop reading as a bar and start reading as blocks. */
const MIN_CELLS = 6;

/** Past this a cell is thinner than its own seam, whatever the width allows. */
const MAX_CELLS = 40;

/**
 * How wide a cell is against its own height.
 *
 * Square divides the bar into the fewest, chunkiest cells it can hold; a little
 * under that buys a finer scale while the cell is still plainly a block rather
 * than a stripe. It is the one number that trades resolution against the shape
 * of a cell, so it is stated here rather than falling out of the arithmetic.
 */
const CELL_ASPECT = 0.8;

/**
 * How many cells fit across the bar, given that a cell is square.
 *
 * The count is measured rather than declared: a widget dragged wider should
 * gain divisions, not stretch the ones it has into slabs. Both terms come from
 * the element itself — the cell's target width is the bar's own height, and the
 * seam is read back from the resolved `column-gap` — so neither has to know
 * about `--wfs` or agree with a number written in the stylesheet.
 *
 * `clientWidth`/`clientHeight` rather than `getBoundingClientRect`: the layout
 * editor scales the whole canvas with a CSS transform, which the rect carries
 * and these two do not. Both terms are read the same way, so the ratio holds
 * either way, but staying in unscaled pixels keeps the clamps meaningful.
 */
export const useChargeCellCount = (
  fallback: number
): { ref: RefCallback<HTMLDivElement>; count: number } => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [count, setCount] = useState(fallback);

  useLayoutEffect(() => {
    if (!element) {
      return;
    }

    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;

      if (!(width > 0) || !(height > 0)) {
        return;
      }

      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      const cell = height * CELL_ASPECT;
      const fitted = Math.round((width + gap) / (cell + gap));

      setCount(Math.min(MAX_CELLS, Math.max(MIN_CELLS, fitted)));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return { ref: setElement, count };
};
