import { useCallback, useReducer, useRef, type RefCallback } from 'react';

export const useVisibleRowCount = <T extends HTMLElement>(
  rowHeightRem: number,
  minRows = 1,
  rowSelector?: string,
  deps: readonly unknown[] = []
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

        if (!(rowPx > 0)) {
          const rootFontSize = parseFloat(
            getComputedStyle(document.documentElement).fontSize
          );
          rowPx = rowHeightRem * rootFontSize;
        }

        if (!(rowPx > 0)) return;

        const headerOffset = firstReal
          ? firstReal.getBoundingClientRect().top -
            el.getBoundingClientRect().top
          : 0;
        const next = Math.max(
          minRows,
          Math.floor((el.clientHeight - headerOffset) / rowPx)
        );
        dispatch(next);
      };

      let rafId1 = 0;
      let rafId2 = 0;
      // Measure now (catches the case where layout is already settled) and
      // again on the next two frames. Row height scales with --wfs, which React
      // commits as an inline style: during a width drag the ResizeObserver can
      // fire before that commit lands, so an immediate-only read sees the stale
      // (shorter) row height and keeps too many rows → overflow on widen.
      const remeasure = () => {
        measure();
        cancelAnimationFrame(rafId1);
        cancelAnimationFrame(rafId2);
        rafId1 = requestAnimationFrame(() => {
          measure();
          rafId2 = requestAnimationFrame(measure);
        });
      };

      remeasure();

      const t1 = setTimeout(remeasure, 100);
      const t2 = setTimeout(remeasure, 400);

      const ro = new ResizeObserver(remeasure);
      ro.observe(el);

      const rootRo = new ResizeObserver(remeasure);
      rootRo.observe(document.documentElement);

      const mo = new MutationObserver(remeasure);
      mo.observe(el, { childList: true, subtree: false });

      cleanupRef.current = () => {
        cancelAnimationFrame(rafId1);
        cancelAnimationFrame(rafId2);
        clearTimeout(t1);
        clearTimeout(t2);
        ro.disconnect();
        rootRo.disconnect();
        mo.disconnect();
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowHeightRem, minRows, rowSelector, ...deps]
  );

  return { ref, count };
};
