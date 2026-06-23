import { useCallback, useReducer, useRef, type RefCallback } from 'react';

export const useVisibleRowCount = <T extends HTMLElement>(
  rowHeightRem: number,
  minRows = 1,
  rowSelector?: string
): { ref: RefCallback<T>; count: number } => {
  const [count, dispatch] = useReducer(
    (state: number, action: number) => (state === action ? state : action),
    minRows
  );

  const cleanupRef = useRef<(() => void) | null>(null);

  const ref = useCallback(
    (el: T | null) => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      if (!el) return;

      const measure = () => {
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
        dispatch(next);
      };

      let rafId = 0;
      const scheduleMeasure = () => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(measure);
      };

      scheduleMeasure();

      const t1 = setTimeout(scheduleMeasure, 100);
      const t2 = setTimeout(scheduleMeasure, 400);

      const ro = new ResizeObserver(scheduleMeasure);
      ro.observe(el);

      const rootRo = new ResizeObserver(scheduleMeasure);
      rootRo.observe(document.documentElement);

      const mo = new MutationObserver(scheduleMeasure);
      mo.observe(el, { childList: true, subtree: false });

      cleanupRef.current = () => {
        cancelAnimationFrame(rafId);
        clearTimeout(t1);
        clearTimeout(t2);
        ro.disconnect();
        rootRo.disconnect();
        mo.disconnect();
      };
    },
    [rowHeightRem, minRows, rowSelector]
  );

  return { ref, count };
};
