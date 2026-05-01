import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Measures a container's height and returns how many rows of `rowHeight`
 * pixels fit inside it. Re-measures on resize via ResizeObserver.
 */
/**
 * Measures a container's height and returns how many rows of `rowHeightRem`
 * (in rem units, evaluated against the document root font-size which the
 * WidgetWrapper rescales) fit inside it. Re-measures on resize.
 */
export const useVisibleRowCount = <T extends HTMLElement>(
  rowHeightRem: number,
  minRows = 1,
  rowSelector?: string
): { ref: RefObject<T | null>; count: number } => {
  const ref = useRef<T | null>(null);
  const [count, setCount] = useState(minRows);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // Prefer measuring an actual rendered child — it accounts for borders,
      // padding, line-height, font scaling and any descendant layout. Falls
      // back to a rem-based estimate when the list has no real children yet.
      let rowPx = 0;
      let firstReal: HTMLElement | null = null;

      if (rowSelector) {
        firstReal = el.querySelector(rowSelector);
      } else {
        firstReal =
          Array.from(el.children).find(
            (c): c is HTMLElement =>
              c instanceof HTMLElement && !c.className.includes('Placeholder')
          ) ?? null;
      }

      if (firstReal) {
        rowPx = firstReal.getBoundingClientRect().height;
      }
      if (rowPx <= 0) {
        const rootFontSize = parseFloat(
          getComputedStyle(document.documentElement).fontSize
        );
        rowPx = rowHeightRem * rootFontSize;
      }
      if (rowPx <= 0) return;
      const next = Math.max(minRows, Math.floor(el.clientHeight / rowPx));
      setCount((prev) => (prev === next ? prev : next));
    };

    let rafId = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };

    scheduleMeasure();

    // Fallback: if the first rAF fires before layout is complete (height = 0),
    // retry at 100ms and 400ms after mount so the count is always correct on
    // cold start without needing a manual resize.
    const t1 = setTimeout(scheduleMeasure, 100);
    const t2 = setTimeout(scheduleMeasure, 400);

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(el);
    // Root font-size also changes when WidgetWrapper rescales — observe that.
    const rootRo = new ResizeObserver(scheduleMeasure);
    rootRo.observe(document.documentElement);
    // Re-measure when children appear/change (real rows replacing placeholders).
    // Uses scheduleMeasure so back-to-back DOM mutations from a React re-render
    // are coalesced into a single rAF tick, preventing oscillation loops.
    const mo = new MutationObserver(scheduleMeasure);
    mo.observe(el, { childList: true, subtree: false });
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      rootRo.disconnect();
      mo.disconnect();
    };
  }, [rowHeightRem, minRows]);

  return { ref, count };
};
